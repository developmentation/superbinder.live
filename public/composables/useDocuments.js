// composables/useDocuments.js
import { useRealTime } from './useRealTime.js';
import { processFile } from '../utils/files/fileProcessor.js';

const documents = Vue.ref([]);
const selectedDocument = Vue.ref(null);
const { emit, on, off } = useRealTime();

const eventHandlers = new WeakMap();

export function useDocuments() {
  function handleAddDocument({ document }) {
    console.log('Handling add-document:', document);
    if (!documents.value.some(d => d.id === document.id)) {
      // Ensure renderAsHtml is set based on file type
      const updatedDocument = {
        ...document,
        renderAsHtml: ['docx', 'xlsx', 'pdf'].includes(document.type),
      };
      documents.value = [...documents.value, updatedDocument];
    }
  }

  function handleRemoveDocument({ id }) {
    console.log('Handling remove-document:', id);
    documents.value = documents.value.filter(d => d.id !== id);
    if (selectedDocument.value && selectedDocument.value.id === id) {
      selectedDocument.value = null;
    }
  }

  function handleRenameDocument({ id, name }) {
    console.log('Handling rename-document:', { id, name });
    const doc = documents.value.find(d => d.id === id);
    if (doc) {
      doc.name = name.trim();
      if (selectedDocument.value && selectedDocument.value.id === id) {
        selectedDocument.value.name = name.trim();
      }
    }
  }

  function handleSnapshot(history) {
    console.log('Handling history snapshot for documents:', history.documents);
    // Ensure renderAsHtml is set for each document in the snapshot
    const updatedDocuments = (history.documents || []).map(doc => ({
      ...doc,
      renderAsHtml: ['docx', 'xlsx', 'pdf'].includes(doc.type),
    })).sort((a, b) => a.timestamp - b.timestamp);
    documents.value = updatedDocuments;
  }

  const addDocumentHandler = on('add-document', handleAddDocument);
  const removeDocumentHandler = on('remove-document', handleRemoveDocument);
  const renameDocumentHandler = on('rename-document', handleRenameDocument);
  const snapshotHandler = on('history-snapshot', handleSnapshot);

  eventHandlers.set(useDocuments, {
    addDocument: addDocumentHandler,
    removeDocument: removeDocumentHandler,
    renameDocument: renameDocumentHandler,
    snapshot: snapshotHandler,
  });

  async function addDocument(file) {
    const doc = await processFile(file);
    if (doc.status === 'complete') {
      const documentWithMetadata = {
        id: doc.id,
        name: doc.name,
        type: doc.type, // Ensure type is included for renderAsHtml
        createdBy: useRealTime().displayName.value,
        timestamp: Date.now(),
        processedContent: doc.processedContent,
        renderAsHtml: ['docx', 'xlsx', 'pdf'].includes(doc.type), // Set renderAsHtml based on type
      };
      documents.value = [...documents.value, documentWithMetadata];
      emit('add-document', { document: documentWithMetadata });
    } else if (doc.status === 'error') {
      console.error(`Failed to process file ${file.name}:`, doc);
    }
    return doc;
  }

  function removeDocument(id) {
    documents.value = documents.value.filter(doc => doc.id !== id);
    emit('remove-document', { id });
    if (selectedDocument.value && selectedDocument.value.id === id) {
      selectedDocument.value = null;
    }
  }

  function updateDocument(id, name) {
    const doc = documents.value.find(d => d.id === id);
    if (doc) {
      doc.name = name.trim();
      if (selectedDocument.value && selectedDocument.value.id === id) {
        selectedDocument.value.name = name.trim();
      }
      emit('rename-document', { id, name: name.trim() });
    }
  }

  function setSelectedDocument(doc) {
    // Ensure renderAsHtml is set if not provided
    selectedDocument.value = doc ? {
      ...doc,
      renderAsHtml: doc.renderAsHtml || ['docx', 'xlsx', 'pdf'].includes(doc.type),
    } : null;
  }

  function cleanup() {
    const handlers = eventHandlers.get(useDocuments);
    if (handlers) {
      off('add-document', handlers.addDocument);
      off('remove-document', handlers.removeDocument);
      off('rename-document', handlers.renameDocument);
      off('history-snapshot', handlers.snapshot);
      eventHandlers.delete(useDocuments);
    }
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