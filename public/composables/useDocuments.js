// composables/useDocuments.js
import { useRealTime } from './useRealTime.js';
import { processFile } from '../utils/files/fileProcessor.js';

const documents = Vue.ref([]);
const selectedDocument = Vue.ref(null);
const { emit, on, off } = useRealTime();

// Store event handlers for cleanup
const eventHandlers = new WeakMap();

export function useDocuments() {
  // Handle adding a document
  function handleAddDocument({ document }) {
    if (!documents.value.some(d => d.id === document.id)) {
      documents.value = [...documents.value, document]; // Preserve order
    }
  }

  // Handle removing a document
  function handleRemoveDocument({ documentId }) {
    documents.value = documents.value.filter(d => d.id !== documentId);
    if (selectedDocument.value && selectedDocument.value.id === documentId) {
      selectedDocument.value = null; // Clear selection if removed
    }
  }

  // Handle renaming/updating a document
  function handleRenameDocument({ documentId, name }) {
    const doc = documents.value.find(d => d.id === documentId);
    if (doc) {
      doc.name = name.trim();
      if (selectedDocument.value && selectedDocument.value.id === documentId) {
        selectedDocument.value.name = name.trim(); // Sync selected document
      }
    }
  }

  // Handle history snapshot
  function handleSnapshot(history) {
    documents.value = (history.documents || []).sort((a, b) => a.timestamp - b.timestamp); // Maintain order by timestamp
  }

  // Register event listeners
  const addDocumentHandler = on('add-document', handleAddDocument);
  const removeDocumentHandler = on('remove-document', handleRemoveDocument);
  const renameDocumentHandler = on('rename-document', handleRenameDocument);
  const snapshotHandler = on('history-snapshot', handleSnapshot);

  // Store handlers for cleanup
  eventHandlers.set(useDocuments, {
    addDocument: addDocumentHandler,
    removeDocument: removeDocumentHandler,
    renameDocument: renameDocumentHandler,
    snapshot: snapshotHandler,
  });

  // Add a document with file processing
  async function addDocument(file) {
    const doc = await processFile(file);
    if (doc.status === 'complete') {
      // Ensure document has metadata consistent with agents
      const documentWithMetadata = {
        id: doc.id, // Use existing id from processFile
        name: doc.name,
        createdBy: useRealTime().displayName.value, // Add creator info
        timestamp: Date.now(), // Add timestamp
        processedContent: doc.processedContent, // Preserve content
        // Add any other metadata from processFile output if needed
      };
      documents.value = [...documents.value, documentWithMetadata];
      emit('add-document', { document: documentWithMetadata }); // Sync with others
    } else if (doc.status === 'error') {
      console.error(`Failed to process file ${file.name}:`, doc);
    }
    return doc;
  }

  // Remove a document
  function removeDocument(documentId) {
    documents.value = documents.value.filter(doc => doc.id !== documentId);
    emit('remove-document', { documentId }); // Sync with others
    if (selectedDocument.value && selectedDocument.value.id === documentId) {
      selectedDocument.value = null; // Clear selection
    }
  }

  // Update/Rename a document (only name for now, extend as needed)
  function updateDocument(documentId, name) {
    const doc = documents.value.find(d => d.id === documentId);
    if (doc) {
      doc.name = name.trim();
      if (selectedDocument.value && selectedDocument.value.id === documentId) {
        selectedDocument.value.name = name.trim(); // Sync selected document
      }
      emit('rename-document', { documentId, name: name.trim() }); // Sync with others
    }
  }

  // Set selected document
  function setSelectedDocument(doc) {
    selectedDocument.value = doc;
  }

  // Cleanup event listeners
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