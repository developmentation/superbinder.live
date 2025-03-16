// components/SectionPickerModal.js
import SectionTreeViewer from './SectionTreeViewer.js';
import { useSections } from '../composables/useSections.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useArtifacts } from '../composables/useArtifacts.js';

export default {
  name: 'SectionPickerModal',
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    uuids: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    const { sections } = useSections();
    const { documents } = useDocuments();
    const { artifacts } = useArtifacts();
    const selectedKeys = Vue.ref({});
    const expandedKeys = Vue.ref({});

    // Pre-check sections based on uuids prop
    Vue.onMounted(() => {
      if (props.uuids.length > 0) {
        const newSelectedKeys = {};
        props.uuids.forEach(id => {
          if (sections.value.some(section => section.id === id)) {
            newSelectedKeys[id] = true;
          }
        });
        selectedKeys.value = newSelectedKeys;
        console.log('Initial selectedKeys after mounting:', selectedKeys.value);
      }
    });

    const expandAll = () => {
      const newExpandedKeys = {};
      sections.value.forEach(section => {
        newExpandedKeys[section.id] = true;
      });
      expandedKeys.value = newExpandedKeys;
      console.log('Expanded all sections:', expandedKeys.value);
    };

    const collapseAll = () => {
      expandedKeys.value = {};
      console.log('Collapsed all sections:', expandedKeys.value);
    };

    const selectAll = () => {
      const newSelectedKeys = {};
      // Select all sections
      sections.value.forEach(section => {
        newSelectedKeys[section.id] = true;
      });
      // Select all documents
      documents.value.forEach(doc => {
        newSelectedKeys[doc.id] = true;
      });
      // Select all artifacts
      artifacts.value.forEach(artifact => {
        newSelectedKeys[artifact.id] = true;
      });
      selectedKeys.value = newSelectedKeys;
      console.log('Selected all nodes (sections, documents, artifacts):', selectedKeys.value);
    };

    const selectNone = () => {
      selectedKeys.value = {};
      console.log('Deselected all nodes:', selectedKeys.value);
    };

    const handleSelect = () => {
      // Screen out document and artifact IDs, keep only section IDs
      const allSelectedIds = Object.keys(selectedKeys.value).filter(key => selectedKeys.value[key]);
      const selectedSectionIds = allSelectedIds.filter(id => 
        sections.value.some(section => section.id === id)
      );
      console.log('Final selected section IDs (filtered to sections only):', selectedSectionIds);
      emit('select', selectedSectionIds);
      // Parent decides whether to close
    };

    const handleClose = () => {
      emit('close');
    };

    return {
      selectedKeys,
      expandedKeys,
      expandAll,
      collapseAll,
      selectAll,
      selectNone,
      handleSelect,
      handleClose,
    };
  },
  template: `
    <div v-if="visible" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-4 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-purple-400">Select Sections</h3>
          <button @click="handleClose" class="text-gray-400 hover:text-gray-200">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="flex gap-2 mb-4">
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
            @click="selectAll"
            class="py-1 px-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-sm flex items-center"
            title="Select All"
          >
            <i class="pi pi-check-square"></i>
          </button>
          <button
            @click="selectNone"
            class="py-1 px-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg text-sm flex items-center"
            title="Select None"
          >
            <i class="pi pi-circle"></i>
          </button>
          <button
            @click="handleSelect"
            class="py-1 px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm flex items-center"
          >
            Confirm Selection
          </button>
        </div>
        <div class="overflow-y-auto flex-1">
          <section-tree-viewer
            :selected-keys="selectedKeys"
            :expanded-keys="expandedKeys"
            @update:selectedKeys="selectedKeys = $event"
            @update:expandedKeys="expandedKeys = $event"
          />
        </div>
      </div>
    </div>
  `,
  components: {
    SectionTreeViewer,
  },
};