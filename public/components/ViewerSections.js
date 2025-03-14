import SectionTreeViewer from './SectionTreeViewer.js';
import LazyScrollViewer from './LazyScrollViewer.js';
import { useDocuments } from '../composables/useDocuments.js';

export default {
  name: 'ViewerSections',
  components: { SectionTreeViewer, LazyScrollViewer },
  setup() {
    const { selectedDocument, setSelectedDocument } = useDocuments();
    const selectedKeys = Vue.ref({});
    const expandedKeys = Vue.ref({});
    const pageItems = Vue.ref([]);
    const parentWidth = Vue.ref(window.innerWidth);

    Vue.watch(
      () => selectedDocument.value,
      (newDoc) => {
        if (newDoc && newDoc.data.type === 'pdf' && newDoc.data.pages) {
          pageItems.value = newDoc.data.pages;
        } else {
          pageItems.value = [];
        }
      },
      { immediate: true }
    );

    Vue.watch(
      () => window.innerWidth,
      (newWidth) => {
        parentWidth.value = newWidth;
      }
    );

    const isPdf = Vue.computed(() => selectedDocument.value?.data?.type === 'pdf');

    const handleNodeSelect = (node) => {
      if (node.type === 'document') {
        const doc = documents.value.find((d) => d.id === node.id);
        setSelectedDocument(doc);
      }
    };

    return {
      selectedDocument,
      selectedKeys,
      expandedKeys,
      pageItems,
      isPdf,
      handleNodeSelect,
      parentWidth,
    };
  },
  template: `
    <div class="h-screen flex flex-col overflow-hidden">
      <div class="flex-1 flex overflow-hidden">
        <div class="w-1/3 overflow-y-auto" style="max-height: calc(100vh - 2rem)">
          <section-tree-viewer
            :selected-keys="selectedKeys"
            :expanded-keys="expandedKeys"
            :parent-width="parentWidth"
            @update:selectedKeys="selectedKeys = $event"
            @update:expandedKeys="expandedKeys = $event"
            @node-select="handleNodeSelect"
          />
        </div>
        <div class="w-2/3 overflow-y-auto">
          <div v-if="selectedDocument" class="p-4">
            <div v-if="isPdf && pageItems.length">
              <lazy-scroll-viewer :pages="pageItems" :buffer="1" />
            </div>
            <div v-else v-html="selectedDocument.data.processedContent" class="prose text-gray-300"></div>
          </div>
          <div v-else class="text-gray-400 h-full flex items-center justify-center">
            Select a document to view.
          </div>
        </div>
      </div>
    </div>
  `,
};