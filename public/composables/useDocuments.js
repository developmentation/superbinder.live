// ./composables/useDocuments.js
import { useRealTime } from './useRealTime.js';
import { useFiles } from './useFiles.js';
import { processFile } from '../utils/files/fileProcessor.js';

const documents = Vue.ref([]);
const selectedDocument = Vue.ref(null);
const { userUuid, displayName, emit, on, off } = useRealTime();
const { retrieveFiles, getFile } = useFiles();
const eventHandlers = new WeakMap();
const processedEvents = new Set();

export function useDocuments() {
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
      selectedDocument.value = null;
    }
  }

  function handleRenameDocument(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const index = documents.value.findIndex(d => d.id === id);
    if (index !== -1) {
      documents.value[index].data.name = data.name;
      documents.value = [...documents.value];
      if (selectedDocument.value && selectedDocument.value.id === id) {
        selectedDocument.value.data.name = data.name;
      }
    }
  }

  const addDocumentHandler = on('add-document', handleAddDocument);
  const removeDocumentHandler = on('remove-document', handleRemoveDocument);
  const renameDocumentHandler = on('rename-document', handleRenameDocument);

  eventHandlers.set(useDocuments, {
    addDocument: addDocumentHandler,
    removeDocument: removeDocumentHandler,
    renameDocument: renameDocumentHandler,
  });

  async function addDocument(file) {
    const uuid = crypto.randomUUID();
    const serverPayload = {
      id: uuid,
      userUuid: userUuid.value,
      data: {
        name: file.name,
        type: file.name.split('.').pop().toLowerCase(),
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified,
        status: 'pending',
      },
      timestamp: Date.now(),
    };
    documents.value.push({ id: uuid, userUuid: userUuid.value, data: serverPayload.data });
    documents.value = [...documents.value];
    emit('add-document', serverPayload);
    return { id: uuid, status: 'pending' };
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
      selectedDocument.value = null;
    }
  }

  function updateDocument(id, name) {
    const index = documents.value.findIndex(d => d.id === id);
    if (index !== -1) {
      const data = { ...documents.value[index].data, name };
      const payload = {
        id,
        userUuid: userUuid.value,
        data: { name },
        timestamp: Date.now(),
      };
      documents.value[index].data.name = name;
      documents.value = [...documents.value];
      if (selectedDocument.value && selectedDocument.value.id === id) {
        selectedDocument.value.data.name = name;
      }
      emit('rename-document', payload);
    }
  }

  function setSelectedDocument(doc) {
    selectedDocument.value = doc ? { ...doc } : null;
  }

  async function retrieveAndRenderFiles() {
    const unprocessedDocs = documents.value.filter(doc => !doc.data.pages && !doc.data.processedContent); // Process all unprocessed files
    if (unprocessedDocs.length === 0) return;

    const uuids = unprocessedDocs.map(doc => doc.id);
    const retrievedFiles = await retrieveFiles(uuids);

    for (const file of retrievedFiles) {
      if (file.data && !file.error) {
        const docIndex = documents.value.findIndex(d => d.id === file.uuid);
        if (docIndex !== -1) {
          const doc = documents.value[docIndex];
          const storedFile = getFile(file.uuid);
          if (storedFile && storedFile.data) {
            const mimeType = doc.data.mimeType || `application/${doc.data.type}`;
            const processed = await processFile(storedFile.data, mimeType);
            doc.data = { 
              ...doc.data, 
              pages: processed.data.pages, 
              pagesText: processed.data.pagesText, 
              processedContent: processed.data.processedContent,
              originalContent: storedFile.data,
              status: processed.data.status,
              renderAsHtml: processed.data.renderAsHtml,
            };
            documents.value = [...documents.value];
            if (selectedDocument.value && selectedDocument.value.id === file.uuid) {
              selectedDocument.value.data = { ...selectedDocument.value.data, ...doc.data };
            }
          } else {
            console.error(`File not found in files.value for UUID ${file.uuid}`);
          }
        }
      } else {
        console.error(`Retrieval error for UUID ${file.uuid}:`, file.error);
      }
    }
  }

  function cleanup() {
    const handlers = eventHandlers.get(useDocuments);
    if (handlers) {
      off('add-document', handlers.addDocument);
      off('remove-document', handlers.removeDocument);
      off('rename-document', handlers.renameDocument);
      eventHandlers.delete(useDocuments);
    }
    processedEvents.clear();
  }

  return {
    documents,
    selectedDocument,
    addDocument,
    removeDocument,
    updateDocument,
    setSelectedDocument,
    retrieveAndRenderFiles, // Renamed from retrieveAndRenderPdfs
    cleanup,
  };
}