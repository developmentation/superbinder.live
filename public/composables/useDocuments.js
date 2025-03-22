// ./composables/useDocuments.js
import { useRealTime } from './useRealTime.js';
import { useFiles } from './useFiles.js';
import { extractPDFText, rasterizePDF } from '../utils/files/processorPDF.js';
import { processDOCX } from '../utils/files/processorDOCX.js';
import { processXLSX } from '../utils/files/processorXLSX.js';
import { processImage } from '../utils/files/processorImage.js';
import { processText } from '../utils/files/processorText.js';

const documents = Vue.ref([]);
const selectedDocument = Vue.ref(null);
const { userUuid, displayName, emit, on, off } = useRealTime();
const { retrieveFiles, getFile, uploadFiles } = useFiles();
const eventHandlers = new WeakMap();
const processedEvents = new Set();

export function useDocuments() {
  function setSelectedDocument(doc) {
    selectedDocument.value = doc ? { ...doc } : null;
  }

  function handleAddDocument(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-document-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!documents.value.some(d => d.id === id)) {
        documents.value.push({ id, userUuid: eventUserUuid, data });
        documents.value = [...documents.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  function handleRemoveDocument(eventObj) {
    const { id, timestamp } = eventObj;
    documents.value = documents.value.filter(d => d.id !== id);
    if (selectedDocument.value && selectedDocument.value.id === id) {
      setSelectedDocument(null);
    }
  }

  function handleUpdateDocument(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    console.log('handleUpdateDocument:', { id, userUuid: eventUserUuid, data, timestamp });
    const index = documents.value.findIndex(d => d.id === id);
    if (index !== -1) {
      documents.value[index].data = { ...documents.value[index].data, ...data };
      documents.value = [...documents.value];
      if (selectedDocument.value && selectedDocument.value.id === id) {
        setSelectedDocument({ ...selectedDocument.value, data: documents.value[index].data });
      }
      console.log('Updated document:', documents.value[index]);
    }
  }

  const addDocumentHandler = on('add-document', handleAddDocument);
  const removeDocumentHandler = on('remove-document', handleRemoveDocument);
  const updateDocumentHandler = on('update-document', handleUpdateDocument);

  eventHandlers.set(useDocuments, {
    addDocument: addDocumentHandler,
    removeDocument: removeDocumentHandler,
    updateDocument: updateDocumentHandler,
  });

  async function addDocument(file, sectionId = null) {
    const uuid = uuidv4();
    const arrayBuffer = await file.arrayBuffer();
    const mimeType = file.type || `application/${file.name.split('.').pop().toLowerCase()}`;
    let processedData;

    try {
      if (mimeType === 'application/pdf') {
        processedData = await extractPDFText(arrayBuffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        processedData = await processDOCX(arrayBuffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'text/csv') {
        processedData = await processXLSX(arrayBuffer, mimeType);
      } else if (mimeType.startsWith('image/')) {
        processedData = processImage(arrayBuffer, mimeType);
      } else if (isTextBased(mimeType)) {
        processedData = processText(arrayBuffer, mimeType);
      } else {
        console.warn(`Unrecognized MIME type '${mimeType}' for file '${file.name}', treating as text`);
        processedData = processText(arrayBuffer, 'text/plain');
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      processedData = { pagesText: [`Error: ${error.message}`], pages: [], pagesHtml: [] };
    }

    const localDocumentData = {
      name: file.name,
      type: file.name.split('.').pop().toLowerCase(),
      mimeType,
      size: file.size,
      lastModified: file.lastModified,
      status: processedData.pagesText ? 'complete' : 'error',
      sectionId,
      originalContent: arrayBuffer,
      pages: processedData.pages || [],
      pagesText: processedData.pagesText || [],
      pagesHtml: processedData.pagesHtml || [],
      renderAs: processedData.renderAs || 'text',
      editStatus: false,
      editor: null,
    };

    const serverDocumentData = {
      name: file.name,
      type: file.name.split('.').pop().toLowerCase(),
      mimeType,
      size: file.size,
      lastModified: file.lastModified,
      status: processedData.pagesText ? 'complete' : 'error',
      sectionId,
      pagesText: processedData.pagesText || [],
      pagesHtml: processedData.pagesHtml || [],
      renderAs: processedData.renderAs || 'text',
      editStatus: false,
      editor: null,
    };

    const serverPayload = {
      id: uuid,
      userUuid: userUuid.value,
      data: serverDocumentData,
      timestamp: Date.now(),
    };

    documents.value.push({ id: uuid, userUuid: userUuid.value, data: localDocumentData });
    documents.value = [...documents.value];
    await uploadFiles([file], [uuid]);
    emit('add-document', serverPayload);
    return { id: uuid, status: localDocumentData.status };
  }

  function updateDocument(id, updates) {
    console.log('updateDocument called:', { id, updates });
    const index = documents.value.findIndex(d => d.id === id);
    if (index !== -1) {
      const updatedLocalData = { ...documents.value[index].data, ...updates, originalContent: documents.value[index].data.originalContent };
      const { pages, originalContent, ...updatedServerData } = updatedLocalData; // Exclude pages and originalContent from server data
      const payload = {
        id,
        userUuid: userUuid.value,
        data: updatedServerData,
        timestamp: Date.now(),
      };
      documents.value[index].data = updatedLocalData;
      documents.value = [...documents.value];
      if (selectedDocument.value && selectedDocument.value.id === id) {
        setSelectedDocument({ ...selectedDocument.value, data: updatedLocalData });
      }
      emit('update-document', payload);
    }
  }

  function updateDocumentOcr(id, pageIndex, ocrText) {
    console.log('updateDocumentOcr called:', { id, pageIndex, ocrText });
    const index = documents.value.findIndex(d => d.id === id);
    if (index !== -1) {
      const currentData = { ...documents.value[index].data };
      const updatedPagesText = [...currentData.pagesText];
      // Ensure pagesText is long enough to accommodate the pageIndex
      while (updatedPagesText.length <= pageIndex) {
        updatedPagesText.push('');
      }
      updatedPagesText[pageIndex] = ocrText;

      const updatedLocalData = { ...currentData, pagesText: updatedPagesText };
      const { pages, originalContent, ...updatedServerData } = updatedLocalData; // Exclude pages and originalContent from server data
      const payload = {
        id,
        userUuid: userUuid.value,
        data: updatedServerData,
        timestamp: Date.now(),
      };

      documents.value[index].data = updatedLocalData;
      documents.value = [...documents.value];
      if (selectedDocument.value && selectedDocument.value.id === id) {
        setSelectedDocument({ ...selectedDocument.value, data: updatedLocalData });
      }
      emit('update-document', payload);
    } else {
      console.warn(`Document with id ${id} not found for OCR update`);
    }
  }

  function removeDocument(id) {
    const payload = {
      id,
      userUuid: userUuid.value,
      data: null,
      timestamp: Date.now(),
    };
    documents.value = documents.value.filter(doc => doc.id !== id);
    documents.value = [...documents.value];
    emit('remove-document', payload);
    if (selectedDocument.value && selectedDocument.value.id === id) {
      setSelectedDocument(null);
    }
  }

  async function retrieveAndRenderFiles() {
    const unprocessedDocs = documents.value.filter(doc => doc.data.type === 'pdf' && !doc.data.pages?.length);
    if (unprocessedDocs.length === 0) return;

    const uuids = unprocessedDocs.map(doc => doc.id);
    try {
      const retrievedFiles = await retrieveFiles(uuids);

      for (const file of retrievedFiles) {
        if (file.data && !file.error) {
          const docIndex = documents.value.findIndex(d => d.id === file.uuid);
          if (docIndex !== -1) {
            const doc = documents.value[docIndex];
            const storedFile = getFile(file.uuid);
            if (storedFile && storedFile.data && doc.data.type === 'pdf') {
              const { pages } = await rasterizePDF(storedFile.data);
              doc.data.pages = pages;
              doc.data.status = 'complete';
              documents.value = [...documents.value];
              updateDocument(file.uuid, { status: 'complete' }); // Don't include pages in update
              if (selectedDocument.value && selectedDocument.value.id === file.uuid) {
                setSelectedDocument({ ...selectedDocument.value, data: doc.data });
              }
            }
          }
        } else {
          console.error(`Retrieval error for UUID ${file.uuid}:`, file.error);
        }
      }
    } catch (error) {
      console.error('Error retrieving and rendering files:', error);
      throw error;
    }
  }

  function cleanup() {
    const handlers = eventHandlers.get(useDocuments);
    if (handlers) {
      off('add-document', handlers.addDocument);
      off('remove-document', handlers.removeDocument);
      off('update-document', handlers.updateDocument);
      eventHandlers.delete(useDocuments);
    }
    processedEvents.clear();
  }

  function isTextBased(mimeType) {
    return (
      mimeType.startsWith('text/') ||
      ['application/json', 'application/javascript', 'text/markdown'].includes(mimeType)
    );
  }

  return {
    documents,
    selectedDocument,
    addDocument,
    removeDocument,
    updateDocument,
    updateDocumentOcr, // Export the new function
    setSelectedDocument,
    retrieveAndRenderFiles,
    cleanup,
  };
}