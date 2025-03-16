// components/SectionSelectorModal.js
import SectionTreeViewer from './SectionTreeViewer.js';

export default {
  name: 'SectionSelectorModal',
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['save', 'close'],
  setup(props, { emit }) {
    const selectedKeys = Vue.ref({});
    const expandedKeys = Vue.ref({});
    const artifactName = Vue.ref(''); // New state for artifact name

    const expandAll = () => {
      const newExpandedKeys = {};
      // Note: This assumes SectionTreeViewer populates its own sections
      expandedKeys.value = newExpandedKeys;
    };

    const collapseAll = () => {
      expandedKeys.value = {};
    };

    const handleSave = () => {
      const selectedSectionIds = Object.keys(selectedKeys.value).filter(key => selectedKeys.value[key]);
      const name = artifactName.value.trim() || ''; // Use empty string if no input, handled by parent
      emit('save', { sectionIds: selectedSectionIds, name });
      // Reset input after save
      artifactName.value = '';
    };

    const handleClose = () => {
      artifactName.value = ''; // Reset on close
      emit('close');
    };

    return {
      selectedKeys,
      expandedKeys,
      artifactName, // Expose new state
      expandAll,
      collapseAll,
      handleSave,
      handleClose,
    };
  },
  template: `
    <div v-if="visible" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-4 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-purple-400">Select Sections for Artifact</h3>
          <button @click="handleClose" class="text-gray-400 hover:text-gray-200">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="mb-4">
          <input
            v-model="artifactName"
            @keypress.enter="handleSave"
            type="text"
            class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
            placeholder="Enter artifact name (optional)"
          />
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
            @click="handleSave"
            class="py-1 px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm flex items-center"
          >
            Save Artifact
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