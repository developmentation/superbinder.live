// composables/useDocuments.js
import { useRealTime } from './useRealTime.js';
import { processFile } from '../utils/files/fileProcessor.js';

const documents = Vue.ref([]);
const selectedDocument = Vue.ref(null);
const { userUuid, displayName, emit, on, off } = useRealTime();
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
    const processedDoc = await processFile(file);
    if (processedDoc.data.status === 'complete') {
      const id = processedDoc.id;
      // Prepare payload for server (exclude pages)
      const serverPayload = {
        id,
        userUuid: userUuid.value,
        data: {
          ...processedDoc.data,
          pages: undefined, // Explicitly exclude pages
        },
        timestamp: Date.now(),
      };
      // Keep full data locally, including pages
      documents.value.push({ id, userUuid: userUuid.value, data: processedDoc.data });
      documents.value = [...documents.value];
      emit('add-document', serverPayload); // Emit payload without pages
    }
    return processedDoc;
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
    cleanup,
  };
}