// components/TreeNode.js
import { useSections } from '../composables/useSections.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useArtifacts } from '../composables/useArtifacts.js';

export default {
  name: 'TreeNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    selectedKeys: {
      type: Object,
      default: () => ({}),
    },
    expandedKeys: {
      type: Object,
      default: () => ({}),
    },
    editingNodeId: {
      type: [String, Number],
      default: null,
    },
    getFileIcon: {
      type: Function,
      required: true,
    },
    isLeaf: {
      type: Function,
      required: true,
    },
  },
  emits: [
    'toggle-select',
    'toggle-expand',
    'dragstart',
    'dragover',
    'dragleave',
    'drop',
    'add-section',
    'start-editing',
    'finish-editing',
    'remove-section',
    'trigger-file-upload',
    'node-select',
    'render-file',
  ],
  setup(props, { emit }) {
    const { removeDocument } = useDocuments();
    const { removeArtifact } = useArtifacts();
    const localNewName = Vue.ref(''); // Local state for editing the name
    const hasFinishedEditing = Vue.ref(false); // Flag to prevent double emission

    // Watch localNewName for debugging
    Vue.watch(localNewName, (newVal, oldVal) => {
      console.log(`localNewName changed for node ${props.node.id}:`, { oldVal, newVal });
    });

    const checkboxClasses = Vue.computed(() => ({
      'border-[#4b5563] bg-[#2d3748]': props.node.data._checkStatus === 'unchecked',
      'border-[#3b82f6] bg-[#3b82f6]': props.node.data._checkStatus === 'checked' || props.node.data._checkStatus === 'halfChecked',
    }));

    const nodeClasses = Vue.computed(() => {
      if (!props.isLeaf(props.node)) {
        return {
          'bg-[#2d3748]': props.node.data._checkStatus === 'checked' || props.node.data._checkStatus === 'halfChecked',
        };
      }
      if (props.node.type === 'artifact') {
        return { 'bg-[#1e3a8a]': true }; // Dark mode blue for artifacts
      }
      return { 'bg-[#2d3748]': true }; // Consistent color for documents
    });

    const handleAddSection = () => {
      emit('add-section', props.node.id);
    };

    const handleRemove = () => {
      if (props.node.type === 'document') {
        removeDocument(props.node.id);
      } else if (props.node.type === 'artifact') {
        removeArtifact(props.node.id);
      } else {
        emit('remove-section', props.node.id);
      }
    };

    const startEditing = (node) => {
      const nodeToEdit = node || props.node;
      localNewName.value = nodeToEdit.data.name || ''; // Initialize with current name
      hasFinishedEditing.value = false; // Reset flag for new edit session
      // console.log('TreeNode startEditing:', { id: nodeToEdit.id, type: nodeToEdit.type, name: nodeToEdit.data.name });
      emit('start-editing', nodeToEdit);
    };

    const finishEditing = (node) => {
      if (hasFinishedEditing.value) return; // Prevent double emission
      hasFinishedEditing.value = true;
      const nodeToEdit = node || props.node;
      // console.log('TreeNode finishEditing:', { id: nodeToEdit.id, type: nodeToEdit.type, originalName: nodeToEdit.data.name, updatedName: localNewName.value });
      emit('finish-editing', { ...nodeToEdit, data: { ...nodeToEdit.data, name: localNewName.value } });
      localNewName.value = ''; // Reset after emitting
      // Force the input to lose focus
      const input = document.querySelector(`#edit-${nodeToEdit.id}`);
      if (input) input.blur();
    };

    const handleFinishEditing = (updatedNode) => {
      // Only re-emit if this TreeNode is the one being edited
      if (props.editingNodeId === updatedNode.id) {
        // console.log('TreeNode handleFinishEditing (re-emitting):', { id: updatedNode.id, type: updatedNode.type, updatedName: updatedNode.data.name });
        emit('finish-editing', updatedNode);
      } else {
        // console.log('TreeNode handleFinishEditing (not re-emitting):', { id: updatedNode.id, currentNodeId: props.node.id, editingNodeId: props.editingNodeId });
      }
    };

    const triggerFileUpload = (nodeId) => {
      emit('trigger-file-upload', nodeId || props.node.id);
    };

    const handleRenderFile = () => {
      emit('render-file', props.node.id);
    };

    const handleNodeClick = (event) => {
      if (
        event.target.closest('.checkbox') ||
        event.target.closest('.expand-collapse') ||
        event.target.closest('.action-buttons')
      ) {
        return;
      }
      if (props.isLeaf(props.node)) {
        emit('node-select', props.node);
      } else {
        emit('toggle-expand', props.node);
      }
    };

    return {
      checkboxClasses,
      nodeClasses,
      localNewName,
      handleAddSection,
      handleRemove,
      startEditing,
      finishEditing,
      handleFinishEditing,
      triggerFileUpload,
      handleRenderFile,
      handleNodeClick,
    };
  },
  template: `
    <div
      class="tree-node"
      draggable="true"
      @dragstart="$emit('dragstart', $event, node)"
      @dragover="$emit('dragover', $event, node)"
      @dragleave="$emit('dragleave')"
      @drop="$emit('drop', $event, node)"
      :class="{ 'pl-6': node.data.sectionId }"
    >
      <div
        class="relative flex items-center py-1 px-2 rounded hover:bg-[#2d3748] cursor-pointer select-none"
        :class="nodeClasses"
        @click="handleNodeClick"
      >
        <div
          v-if="!isLeaf(node)"
          class="w-4 h-4 flex items-center justify-center mr-1 text-[#94a3b8] expand-collapse"
          @click.stop="$emit('toggle-expand', node)"
        >
          <i
            :class="['pi', node.data._expanded ? 'pi-caret-down' : 'pi-caret-right']"
            class="text-[#94a3b8] text-sm"
          ></i>
        </div>
        <div v-else class="w-4 mr-1"></div>

        <div
          class="w-4 h-4 mr-2 border rounded flex items-center justify-center checkbox"
          :class="checkboxClasses"
          @click.stop="$emit('toggle-select', node)"
        >
          <svg
            v-if="node.data._checkStatus !== 'unchecked'"
            class="w-3 h-3 text-white"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              v-if="node.data._checkStatus === 'checked'"
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
            <rect v-else x="4" y="9" width="12" height="2" rx="1" />
          </svg>
        </div>

        <div class="flex-1 flex items-center justify-between min-w-0 relative">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span :class="isLeaf(node) ? getFileIcon(node.data.name) : 'pi pi-folder'" class="text-[#94a3b8] text-sm"></span>
            <span
              v-if="!editingNodeId || editingNodeId !== node.id"
              class="truncate text-[#e2e8f0] text-sm"
            >
              {{ node.data.name || 'Unnamed' }}
            </span>
            <input
              v-else
              :id="'edit-' + node.id"
              v-model="localNewName"
              @keypress.enter="finishEditing(node)"
              class="bg-transparent text-[#e2e8f0] border-b border-[#4b5563] focus:border-[#3b82f6] outline-none flex-1 min-w-0 text-sm"
              placeholder="Rename node"
            />
          </div>
          <div class="absolute bottom-0 left-0 right-12 h-[1px] bg-[#4b5563] z-0"></div>
          <div class="flex gap-1 z-10 action-buttons">
            <button v-if="!isLeaf(node)" @click.stop="handleAddSection" class="text-[#10b981] hover:text-[#059669] p-1">
              <i class="pi pi-plus text-sm"></i>
            </button>
            <button v-if="!isLeaf(node)" @click.stop="triggerFileUpload(node.id)" class="text-[#3b82f6] hover:text-[#2563eb] p-1">
              <i class="pi pi-upload text-sm"></i>
            </button>
            <button @click.stop="startEditing(node)" class="text-[#f59e0b] hover:text-[#d97706] p-1">
              <i class="pi pi-pencil text-sm"></i>
            </button>
            <button v-if="isLeaf(node) && (node.data.type === 'pdf' || ['png', 'jpg', 'jpeg', 'webp'].includes(node.data.type) || node.data.type === 'svg') && !node.data.pages" @click.stop="handleRenderFile" class="text-[#3b82f6] hover:text-[#2563eb] p-1">
              <i class="pi pi-eye text-sm"></i>
            </button>
            <button @click.stop="handleRemove" class="text-[#ef4444] hover:text-[#dc2626] p-1">
              <i class="pi pi-trash text-sm"></i>
            </button>
          </div>
        </div>
      </div>

      <div v-if="!isLeaf(node) && node.data._expanded" class="pl-6">
        <tree-node
          v-for="childNode in node.data._children"
          :key="childNode.id"
          :node="childNode"
          :selected-keys="selectedKeys"
          :expanded-keys="expandedKeys"
          :editing-node-id="editingNodeId"
          :get-file-icon="getFileIcon"
          :is-leaf="isLeaf"
          @toggle-select="$emit('toggle-select', $event)"
          @toggle-expand="$emit('toggle-expand', $event)"
          @dragstart="$emit('dragstart', $event, $event.target)"
          @dragover="$emit('dragover', $event, $event.target)"
          @dragleave="$emit('dragleave')"
          @drop="$emit('drop', $event, $event.target)"
          @add-section="$emit('add-section', $event)"
          @start-editing="startEditing"
          @finish-editing="handleFinishEditing"
          @remove-section="$emit('remove-section', $event)"
          @trigger-file-upload="triggerFileUpload"
          @render-file="$emit('render-file', $event)"
          @node-select="$emit('node-select', $event)"
        />
      </div>
    </div>
  `,
};