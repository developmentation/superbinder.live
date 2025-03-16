// components/ViewerSections.js
import SectionTreeViewer from './SectionTreeViewer.js';
import ViewPDFs from './ViewPDFs.js';
import ViewDocs from './ViewDocs.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useFiles } from '../composables/useFiles.js';
import { useSections } from '../composables/useSections.js';
import { regeneratePdfPages } from '../utils/files/fileProcessor.js';

export default {
  name: 'ViewerSections',
  components: { SectionTreeViewer, ViewPDFs, ViewDocs },
  setup() {
    const { documents, selectedDocument, setSelectedDocument, addDocument, retrieveAndRenderFiles } = useDocuments();
    const { uploadFiles } = useFiles();
    const { sections, addSection } = useSections();
    const selectedKeys = Vue.ref({});
    const expandedKeys = Vue.ref({});
    const isLoadingFiles = Vue.ref(false);
    const isProcessingFiles = Vue.ref(false);

    const treeNodes = Vue.computed(() => {
      return documents.value.map(doc => ({
        ...doc,
        type: 'document',
        data: {
          ...doc.data,
          _children: [],
          _checkStatus: selectedKeys.value[doc.id] ? 'checked' : 'unchecked',
          _expanded: false,
        },
      }));
    });

    const handleNodeSelect = (node) => {
      if (node.type === 'document') {
        const doc = documents.value.find(d => d.id === node.id);
        setSelectedDocument(doc);
      }
    };

    const handleFileUpload = async (event, sectionId = null) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const uuids = [];
      for (const file of files) {
        const result = await addDocument(file, sectionId);
        uuids.push(result.id);
      }

      try {
        const { results } = await uploadFiles(Array.from(files), uuids);
        const failures = results.filter(result => !result.saved || (result.uuid && !result.renamedCorrectly));
        if (failures.length > 0) {
          console.error('Upload failures:', failures);
          alert(`Some files failed to upload: ${failures.map(f => f.originalName).join(', ')}`);
          return;
        }
        await retrieveAndRenderFiles(); // Trigger rendering after successful upload
      } catch (error) {
        console.error('Error during upload process:', error);
        alert('Failed to upload files. Please try again.');
      }
      event.target.value = '';
    };

    const processFiles = async () => {
      isProcessingFiles.value = true;
      try {
        const unprocessedDocs = documents.value.filter(doc => !(doc.data.pages || doc.data.processedContent));
        for (const doc of unprocessedDocs) {
          if (doc.data.type === 'pdf' && doc.data.originalContent && !doc.data.pages) {
            const { pages, textContent } = await regeneratePdfPages(doc.data.originalContent);
            doc.data.pages = pages;
            doc.data.pagesText = textContent;
            doc.data.status = 'complete';
          } else if (['docx', 'txt', 'html', 'css', 'js', 'json', 'md', 'xlsx'].includes(doc.data.type)) {
            await retrieveAndRenderFiles();
          }
        }
      } catch (error) {
        console.error('Error processing files:', error);
      } finally {
        isProcessingFiles.value = false;
      }
    };

    const handleAddRootSection = () => {
      addSection('New Root Section');
    };

    // Update expandedKeys based on sections
    const expandAll = () => {
      const newExpandedKeys = { ...expandedKeys.value };
      sections.value.forEach(section => {
        newExpandedKeys[section.id] = true;
      });
      expandedKeys.value = newExpandedKeys;
    };

    const collapseAll = () => {
      expandedKeys.value = {}; // Clear all expanded keys
    };

    return {
      treeNodes,
      selectedDocument,
      selectedKeys,
      expandedKeys,
      isLoadingFiles,
      isProcessingFiles,
      handleNodeSelect,
      handleFileUpload,
      processFiles,
      handleAddRootSection,
      expandAll,
      collapseAll,
    };
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <div class="flex flex-col md:flex-row h-full">
        <!-- SectionTreeViewer (Left Column) -->
        <div class="w-full md:w-1/2 border-r border-[#2d3748] overflow-hidden">
          <div class="p-4 bg-[#1a2233] border-b border-[#2d3748] flex items-center justify-between">
            <h3 class="text-lg font-semibold text-[#4dabf7]">Sections</h3>
            <div class="flex gap-2">
              <button
                @click="handleAddRootSection"
                class="py-1 px-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-sm flex items-center"
                title="Add Root Section"
              >
                <i class="pi pi-plus"></i>
              </button>
              <button
                @click="expandAll"
                class="py-1 px-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-sm flex items-center"
                title="Expand All"
              >
                <i class="pi pi-angle-double-down"></i>
              </button>
              <button
                @click="collapseAll"
                class="py-1 px-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg text-sm flex items-center"
                title="Collapse All"
              >
                <i class="pi pi-angle-double-up"></i>
              </button>
              <button
                @click="processFiles"
                :disabled="isProcessingFiles"
                class="py-1 px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm disabled:bg-[#4b5563] disabled:cursor-not-allowed flex items-center"
              >
                <i class="pi pi-refresh mr-2" v-if="isProcessingFiles"></i>
                {{ isProcessingFiles ? 'Processing Files...' : 'Load and Process Files' }}
              </button>
            </div>
          </div>
          <div class="h-full overflow-y-auto">
            <section-tree-viewer
              :selected-keys="selectedKeys"
              :expanded-keys="expandedKeys"
              @update:selectedKeys="selectedKeys = $event"
              @update:expandedKeys="expandedKeys = $event"
              @node-select="handleNodeSelect"
              @upload-files="handleFileUpload"
            />
          </div>
        </div>

        <!-- Document Viewer (Right Column) -->
        <div class="w-full md:w-1/2 overflow-hidden">
          <div v-if="selectedDocument" class="h-full">
            <ViewPDFs
              v-if="selectedDocument.data.type === 'pdf'"
              :document="selectedDocument"
            />
            <ViewDocs
              v-else
              :document="selectedDocument"
            />
          </div>
          <div v-else class="h-full flex items-center justify-center text-[#94a3b8] text-sm">
            Select a document to view.
          </div>
        </div>
      </div>
    </div>
  `,
};