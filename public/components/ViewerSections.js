// components/ViewerSections.js
import SectionTreeViewer from './SectionTreeViewer.js';
import ViewerEditor from './ViewerEditor.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useArtifacts } from '../composables/useArtifacts.js';
import { useFiles } from '../composables/useFiles.js';
import { useSections } from '../composables/useSections.js';
import { rasterizePDF } from '../utils/files/processorPDF.js';

export default {
  name: 'ViewerSections',
  components: { SectionTreeViewer, ViewerEditor },
  setup() {
    const { 
      documents, 
      selectedDocument, 
      setSelectedDocument, 
      addDocument, 
      retrieveAndRenderFiles, 
      updateDocumentOcr 
    } = useDocuments();
    const { artifacts, selectedArtifact, setSelectedArtifact } = useArtifacts();
    const { uploadFiles, files, retrieveFiles, ocrFiles } = useFiles();
    const { sections, addSection } = useSections();
    const selectedKeys = Vue.ref({});
    const expandedKeys = Vue.ref({});
    const isLoadingFiles = Vue.ref(false);

    const treeNodes = Vue.computed(() => {
      const docNodes = documents.value.map(doc => ({
        ...doc,
        type: 'document',
        data: {
          ...doc.data,
          _children: [],
          _checkStatus: selectedKeys.value[doc.id] ? 'checked' : 'unchecked',
          _expanded: false,
        },
      }));

      const artifactNodes = artifacts.value.map(artifact => ({
        ...artifact,
        type: 'artifact',
        data: {
          ...artifact.data,
          name: artifact.data.name || `Artifact ${artifact.id.slice(0, 8)}`,
          _children: [],
          _checkStatus: selectedKeys.value[artifact.id] ? 'checked' : 'unchecked',
          _expanded: false,
        },
      }));

      return [...docNodes, ...artifactNodes];
    });

    const handleNodeSelect = (node) => {
      console.log('Selected node:', node);
      if (node.type === 'document') {
        const doc = documents.value.find(d => d.id === node.id);
        setSelectedDocument({ ...doc, type: 'document' });
        setSelectedArtifact(null);
      } else if (node.type === 'artifact') {
        const artifact = artifacts.value.find(a => a.id === node.id);
        setSelectedArtifact({ ...artifact, type: 'artifact' });
        setSelectedDocument(null);
      }
    };

    const handleFileUpload = async (event, sectionId = null) => {
      const fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;

      const uploadedFiles = Array.from(fileList);
      const uuids = [];
      const fileMap = new Map(); // Map UUIDs to original File objects

      // Step 1: Add documents and collect UUIDs
      for (const file of uploadedFiles) {
        const result = await addDocument(file, sectionId);
        uuids.push(result.id);
        fileMap.set(result.id, file);
      }

      try {
        isLoadingFiles.value = true;

        // Step 2: Upload files to the server
        const { results } = await uploadFiles(uploadedFiles, uuids);
        const failures = results.filter(result => !result.saved || (result.uuid && !result.renamedCorrectly));
        if (failures.length > 0) {
          console.error('Upload failures:', failures);
          alert(`Some files failed to upload: ${failures.map(f => f.originalName).join(', ')}`);
          return;
        }

        // Step 3: Filter image files and perform OCR
        const imageTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
        const imageFiles = uploadedFiles.filter(file => imageTypes.includes(file.type));
        if (imageFiles.length > 0) {
          const imageUuids = imageFiles.map(file => uuids[uploadedFiles.indexOf(file)]);
          const documentData = imageFiles; // Raw File objects (Blobs)
          const pages = imageFiles.map(() => 0); // All images are page 0

          try {
            const ocrResults = await ocrFiles(imageUuids, documentData, pages);
            ocrResults.uuids.forEach((uuid, index) => {
              const text = ocrResults.text[index];
              const page = ocrResults.pages[index];
              if (text && page === 0) {
                updateDocumentOcr(uuid, 0, text);
              }
            });
          } catch (ocrError) {
            console.error('OCR processing failed:', ocrError);
            alert('OCR processing failed for some images.');
          }
        }

        // Step 4: Retrieve and render files (for PDFs, etc.)
        await retrieveAndRenderFiles();
      } catch (error) {
        console.error('Error during upload process:', error);
        alert('Failed to upload files. Please try again.');
      } finally {
        event.target.value = '';
        isLoadingFiles.value = false;
      }
    };

    const renderFiles = async () => {
      const imageTypes = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
      const renderableDocs = documents.value.filter(doc => 
        (doc.data.type === 'pdf' || imageTypes.includes(doc.data.type)) && !doc.data.pages?.length
      );
      if (renderableDocs.length === 0) return;

      try {
        isLoadingFiles.value = true;
        const idsToFetch = renderableDocs.map(doc => doc.id);
        if (idsToFetch.length > 0) {
          await retrieveFiles(idsToFetch);
        }

        for (const doc of renderableDocs) {
          const file = files.value[doc.id];
          if (file && file.data) {
            if (doc.data.type === 'pdf') {
              const { pages } = await rasterizePDF(file.data);
              doc.data.pages = pages;
            } else if (imageTypes.includes(doc.data.type)) {
              const blob = new Blob([file.data], { type: doc.data.mimeType });
              const url = URL.createObjectURL(blob);
              doc.data.pages = [url];
            }
            doc.data.status = 'complete';
            documents.value = [...documents.value];
            if (selectedDocument.value && selectedDocument.value.id === doc.id) {
              setSelectedDocument({ ...doc, type: 'document' });
            }
          } else {
            console.warn(`File data not found for document ${doc.id} after fetch`);
          }
        }
      } catch (error) {
        console.error('Error rendering files:', error);
        alert('Failed to render files.');
      } finally {
        isLoadingFiles.value = false;
      }
    };

    const customRetrieveAndRenderFiles = async () => {
      const imageTypes = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
      const renderableDocs = documents.value.filter(doc => 
        (doc.data.type === 'pdf' || imageTypes.includes(doc.data.type)) && !doc.data.pages?.length
      );
      if (renderableDocs.length === 0) return;

      try {
        isLoadingFiles.value = true;
        const idsToFetch = renderableDocs.map(doc => doc.id);
        if (idsToFetch.length > 0) {
          await retrieveFiles(idsToFetch);
        }
      } catch (error) {
        console.error('Error loading files:', error);
        alert('Failed to load files.');
      } finally {
        isLoadingFiles.value = false;
      }
    };

    const handleAddRootSection = () => {
      addSection('New Root Section');
    };

    const expandAll = () => {
      const newExpandedKeys = { ...expandedKeys.value };
      sections.value.forEach(section => {
        newExpandedKeys[section.id] = true;
      });
      expandedKeys.value = newExpandedKeys;
    };

    const collapseAll = () => {
      expandedKeys.value = {};
    };

    return {
      treeNodes,
      selectedDocument,
      selectedArtifact,
      selectedKeys,
      expandedKeys,
      isLoadingFiles,
      handleNodeSelect,
      handleFileUpload,
      renderFiles,
      handleAddRootSection,
      expandAll,
      collapseAll,
      retrieveAndRenderFiles: customRetrieveAndRenderFiles,
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
                @click="retrieveAndRenderFiles"
                :disabled="isLoadingFiles"
                class="py-1 px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm disabled:bg-[#4b5563] disabled:cursor-not-allowed flex items-center"
              >
                {{ isLoadingFiles ? 'Loading Files...' : 'Load Files' }}
              </button>
              <button
                @click="renderFiles"
                :disabled="isLoadingFiles"
                class="py-1 px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm disabled:bg-[#4b5563] disabled:cursor-not-allowed flex items-center"
              >
                {{ isLoadingFiles ? 'Rendering Files...' : 'Render Files' }}
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
            <div class="h-[200px]"></div>
          </div>
        </div>

        <!-- Document/Artifact Viewer (Right Column) -->
        <div class="w-full md:w-1/2 overflow-hidden">
          <viewer-editor
            v-if="selectedDocument || selectedArtifact"
            :item="selectedDocument || selectedArtifact"
            class="h-full"
          />
          <div v-else class="h-full flex items-center justify-center text-[#94a3b8] text-sm">
            Select a document or artifact to view.
          </div>
        </div>
      </div>
    </div>
  `,
};