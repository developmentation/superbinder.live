// components/TreeNode.js
import { useSections } from '../composables/useSections.js';
import { useDocuments } from '../composables/useDocuments.js';

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
    newName: {
      type: String,
      default: '',
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
  ],
  setup(props, { emit }) {
    const { updateSection } = useSections();
    const { updateDocument, removeDocument } = useDocuments();
    const editingName = Vue.ref(props.node.data.name);

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
      const isProcessed = props.node.data.pages || props.node.data.processedContent;
      return {
'bg-[#97330a]': !isProcessed,
'bg-[#10602f]': isProcessed,
      };
    });

    const handleAddSection = () => {
      emit('add-section', props.node.id);
    };

    const handleRemove = () => {
      if (props.isLeaf(props.node)) {
        removeDocument(props.node.id);
      } else {
        emit('remove-section', props.node.id);
      }
    };

    const startEditing = () => {
      emit('start-editing', props.node);
    };

    const finishEditing = () => {
      const updatedName = editingName.value.trim();
      if (updatedName) {
        if (props.isLeaf(props.node)) {
          updateDocument(props.node.id, updatedName, props.node.data.sectionId);
        } else {
          updateSection(props.node.id, updatedName);
        }
      }
      emit('finish-editing', props.node.id, updatedName || props.node.data.name);
    };

    const triggerFileUpload = () => {
      emit('trigger-file-upload', props.node.id);
    };

    return {
      checkboxClasses,
      nodeClasses,
      editingName,
      handleAddSection,
      handleRemove,
      startEditing,
      finishEditing,
      triggerFileUpload,
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
        @click="!isLeaf(node) && $emit('toggle-expand', node)"
      >
        <!-- Expand/Collapse Icon -->
        <div
          v-if="!isLeaf(node)"
          class="w-4 h-4 flex items-center justify-center mr-1 text-[#94a3b8]"
          @click.stop="$emit('toggle-expand', node)"
        >
          <i
            :class="['pi', node.data._expanded ? 'pi-caret-down' : 'pi-caret-right']"
            class="text-[#94a3b8] text-sm"
          ></i>
        </div>
        <div v-else class="w-4 mr-1"></div>

        <!-- Checkbox -->
        <div
          class="w-4 h-4 mr-2 border rounded flex items-center justify-center"
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

        <!-- Node Content -->
        <div class="flex-1 flex items-center justify-between min-w-0 relative">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span :class="isLeaf(node) ? getFileIcon(node.data.name) : 'pi pi-folder'" class="text-[#94a3b8] text-sm"></span>
            <span v-if="!editingNodeId || editingNodeId !== node.id" class="truncate text-[#e2e8f0] text-sm">
              {{ node.data.name }}
            </span>
            <input
              v-else
              v-model="editingName"
              @keypress.enter="finishEditing"
              @blur="finishEditing"
              class="bg-transparent text-[#e2e8f0] border-b border-[#4b5563] focus:border-[#3b82f6] outline-none flex-1 min-w-0 text-sm"
              placeholder="Rename node"
            />
          </div>
          <!-- Connecting Line (Moved to Bottom) -->
          <div class="absolute bottom-0 left-0 right-12 h-[1px] bg-[#4b5563] z-0"></div>
          <!-- Buttons -->
          <div class="flex gap-1 z-10">
            <button v-if="!isLeaf(node)" @click.stop="handleAddSection" class="text-[#10b981] hover:text-[#059669] p-1">
              <i class="pi pi-plus text-sm"></i>
            </button>
            <button v-if="!isLeaf(node)" @click.stop="triggerFileUpload" class="text-[#3b82f6] hover:text-[#2563eb] p-1">
              <i class="pi pi-upload text-sm"></i>
            </button>
            <button @click.stop="startEditing" class="text-[#f59e0b] hover:text-[#d97706] p-1">
              <i class="pi pi-pencil text-sm"></i>
            </button>
            <button @click.stop="handleRemove" class="text-[#ef4444] hover:text-[#dc2626] p-1">
              <i class="pi pi-trash text-sm"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Child Nodes -->
      <div v-if="!isLeaf(node) && node.data._expanded" class="pl-6">
        <tree-node
          v-for="childNode in node.data._children"
          :key="childNode.id"
          :node="childNode"
          :selected-keys="selectedKeys"
          :expanded-keys="expandedKeys"
          :editing-node-id="editingNodeId"
          :new-name="editingName"
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
          @finish-editing="finishEditing"
          @remove-section="$emit('remove-section', $event)"
          @trigger-file-upload="triggerFileUpload"
        />
      </div>
    </div>
  `,
};