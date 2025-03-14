// ./components/TreeNode.js
export default {
    name: "TreeNode",
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
      isSelected: {
        type: Function,
        required: true,
      },
      isIndeterminate: {
        type: Function,
        required: true,
      },
      isExpanded: {
        type: Function,
        required: true,
      },
      getCheckboxClasses: {
        type: Function,
        required: true,
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
      const handleAddSection = () => {
        console.log('Emitting add-section for node:', props.node.id, props.node.data.name);
        emit('add-section', props.node.id);
      };
  
      // Local state for the input value during editing
      const localName = Vue.ref('');
  
      // Watch for changes to editingNodeId and newName to initialize localName
      Vue.watch(
        () => props.editingNodeId,
        (newId) => {
          if (newId === props.node.id) {
            localName.value = props.newName; // Initialize with the passed newName
          }
        }
      );
  
      // Emit the updated name when editing is finished
      const finishEditing = () => {
        console.log("Finish Editing", {id:props.node.id, localName:localName.value.trim()})
        if (localName.value.trim()) {
          emit('finish-editing', props.node.id, localName.value.trim());
        } else {
          emit('finish-editing', props.node.id, props.node.data.name); // Revert to original name if empty
        }
      };
  
      // Debug log to check isLeaf evaluation
      console.log(`Node ${props.node.id} (${props.node.data.name}) - isLeaf: ${props.isLeaf(props.node)}`);
  
      return {
        handleAddSection,
        localName,
        finishEditing,
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
          class="flex items-center py-1 px-2 rounded hover:bg-gray-800 cursor-pointer select-none"
          :class="{ 'bg-gray-800': isSelected(node) }"
          @click="!isLeaf(node) && $emit('toggle-expand', node)"
        >
          <!-- Expand/Collapse Icon -->
          <div
            v-if="!isLeaf(node)"
            class="w-4 h-4 flex items-center justify-center mr-1 text-gray-400"
            @click.stop="$emit('toggle-expand', node)"
          >
            <i
              :class="['pi', isExpanded(node) ? 'pi-caret-down' : 'pi-caret-up']"
              class="text-gray-400"
            ></i>
          </div>
          <div v-else class="w-4 mr-1"></div>
  
          <!-- Checkbox -->
          <div
            class="w-4 h-4 mr-2 border rounded flex items-center justify-center"
            :class="getCheckboxClasses(node)"
            @click.stop="$emit('toggle-select', node)"
          >
            <svg
              v-if="isSelected(node) || isIndeterminate(node)"
              class="w-3 h-3 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                v-if="isSelected(node)"
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
              <rect v-else x="4" y="9" width="12" height="2" rx="1" />
            </svg>
          </div>
  
          <!-- Node Content -->
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2 min-w-0">
              <span :class="isLeaf(node) ? getFileIcon(node.data.name) : 'pi pi-folder'" class="text-gray-400"></span>
              <span v-if="!editingNodeId || editingNodeId !== node.id" class="truncate text-gray-200">
                {{ node.data.name }}
              </span>
              <input
                v-else
                :id="'edit-' + node.id"
                v-model="localName"
                @keypress.enter="finishEditing"
                @blur="finishEditing"
                class="bg-transparent text-white border-b border-gray-500 focus:border-purple-400 outline-none flex-1 min-w-0"
                placeholder="Rename section"
              />
            </div>
            <!-- Buttons for sections only -->
            <div v-if="!isLeaf(node)" class="flex gap-2">
              <button @click.stop="handleAddSection">➕</button>
              <button @click.stop="$emit('start-editing', node)">✏️</button>
              <button @click.stop="$emit('remove-section', node.id)">🗑️</button>
              <button @click.stop="$emit('trigger-file-upload', node.id)" class="pi pi-upload text-green-400"></button>
            </div>
          </div>
        </div>
  
        <!-- Child Nodes -->
        <div v-if="!isLeaf(node) && isExpanded(node)" class="pl-6">
          <TreeNode
            v-for="childNode in node.data.children"
            :key="childNode.id"
            :node="childNode"
            :selected-keys="selectedKeys"
            :expanded-keys="expandedKeys"
            :editing-node-id="editingNodeId"
            :new-name="newName"
            :is-selected="isSelected"
            :is-indeterminate="isIndeterminate"
            :is-expanded="isExpanded"
            :get-checkbox-classes="getCheckboxClasses"
            :get-file-icon="getFileIcon"
            :is-leaf="isLeaf"
            @toggle-select="$emit('toggle-select', $event)"
            @toggle-expand="$emit('toggle-expand', $event)"
            @dragstart="$emit('dragstart', $event, $event.target)"
            @dragover="$emit('dragover', $event, $event.target)"
            @dragleave="$emit('dragleave')"
            @drop="$emit('drop', $event, $event.target)"
            @add-section="$emit('add-section', $event)"
            @start-editing="$emit('start-editing', $event)"
            @finish-editing="$emit('finish-editing', $event)"
            @remove-section="$emit('remove-section', $event)"
            @trigger-file-upload="$emit('trigger-file-upload', $event)"
          />
        </div>
      </div>
    `,
  };