// components/Uploads.js
import { useDocuments } from '../composables/useDocuments.js';
import { useRealTime } from '../composables/useRealTime.js';

export default {
  name: 'Uploads',
  template: `
    <div class="p-2 h-full overflow-y-auto">
      <h3 class="text-lg font-semibold text-purple-400 mb-4">Uploads</h3>
      
      <!-- Drag and Drop Area with Upload Button -->
      <div 
        ref="dropZone" 
        class="border-2 border-dashed border-gray-600 p-4 mb-4 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-pointer text-gray-300"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
        @click="triggerFileUpload"  
      >
        <div class="flex items-center justify-center space-x-2">
          <i class="pi pi-file-plus text-xl"></i>
          <span>Drag and drop files here, or click to upload</span>
        </div>
        <input 
          type="file" 
          ref="fileInput" 
          class="hidden" 
          @change="handleFileUpload" 
          accept=".docx,.pdf,.pptx,.html,.txt,.js,.json,.css,.md,.xlsx"
          multiple
        />
      </div>

      <!-- Document List -->
      <div v-if="documents.length" class="space-y-2">
        <div 
          v-for="doc in documents" 
          :key="doc.id" 
          class="flex items-center justify-between p-2 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer"
          @click="selectDocument(doc)"
        >
          <div class="flex items-center space-x-2">
            <i :class="getFileIcon(doc.name)"></i>
            <input
              v-model="doc.name"
              @change="renameDocument(doc.id, $event)"
              class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              placeholder="Rename document"
            />
          </div>
          <button @click.stop="removeDocumentLocal(doc.id)" class="ml-2.5 text-red-400 hover:text-red-300">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
      <div v-else class="text-gray-400 text-center">No documents yet.</div>
    </div>
  `,
  setup() {
    const { documents, addDocument, removeDocument, setSelectedDocument, updateDocument } = useDocuments();
    const { emit } = useRealTime();
    const dropZone = Vue.ref(null);
    const fileInput = Vue.ref(null);

    // Handle drag-and-drop events
    function onDragOver(event) {
      event.preventDefault();
      dropZone.value.classList.add('border-purple-400', 'bg-gray-600');
    }

    function onDragLeave(event) {
      event.preventDefault();
      dropZone.value.classList.remove('border-purple-400', 'bg-gray-600');
    }

    async function onDrop(event) {
      event.preventDefault();
      dropZone.value.classList.remove('border-purple-400', 'bg-gray-600');
      const files = event.dataTransfer.files;
      await handleFiles(files);
    }

    // Handle file input click/upload
    async function handleFileUpload(event) {
      const files = event.target.files;
      await handleFiles(files);
      fileInput.value.value = ''; // Reset input
    }

    // Trigger file input click
    function triggerFileUpload() {
      fileInput.value.click();
    }

    /**
     * Delegate file handling to useDocuments, Adds multiple documents from an array of files.
     * @param files Array of files to add.
     */
    async function handleFiles(files) {
      for (const file of Array.from(files)) {
        await addDocument(file);
      }
    }

    /**
     * Sets the document to the selected document. 
     * @param doc document to select.
     */
    function selectDocument(doc) {
      setSelectedDocument(doc);
    }

    // Rename document and sync with others
    function renameDocument(docId, newName) {
      if (newName.trim()) {
        updateDocument(docId, newName.trim()); // Use updateDocument from useDocuments
      }
    }

    // Remove document locally and sync
    function removeDocumentLocal(docId) {
      removeDocument(docId); // Use removeDocument from useDocuments
    }

    // Get file icon based on name (fallback if type is missing)
    function getFileIcon(fileName) {
      const extension = fileName.includes('.') 
        ? fileName.split('.').pop().toLowerCase() 
        : 'default'; // Fallback to 'default' if no extension
      const iconMap = {
        js: 'pi pi-code',
        jsx: 'pi pi-code',
        ts: 'pi pi-code',
        tsx: 'pi pi-code',
        html: 'pi pi-code',
        css: 'pi pi-palette',
        scss: 'pi pi-palette',
        json: 'pi pi-database',
        xml: 'pi pi-database',
        csv: 'pi pi-table',
        md: 'pi pi-file-edit',
        txt: 'pi pi-file-edit',
        doc: 'pi pi-file-word',
        docx: 'pi pi-file-word',
        pdf: 'pi pi-file-pdf',
        png: 'pi pi-image',
        jpg: 'pi pi-image',
        jpeg: 'pi pi-image',
        gif: 'pi pi-image',
        svg: 'pi pi-image',
        yml: 'pi pi-cog',
        yaml: 'pi pi-cog',
        config: 'pi pi-cog',
        env: 'pi pi-cog',
        gitignore: 'pi pi-github',
        lock: 'pi pi-lock',
        xlsx: 'pi pi-file-excel',
        default: 'pi pi-file',
      };
      return iconMap[extension] || iconMap.default;
    }

    return {
      documents,
      dropZone,
      fileInput,
      onDragOver,
      onDragLeave,
      onDrop,
      handleFileUpload,
      triggerFileUpload,
      selectDocument,
      renameDocument,
      removeDocumentLocal,
      getFileIcon,
    };
  },
};