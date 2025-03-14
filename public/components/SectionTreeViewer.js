// ./components/SectionTreeViewer.js
import { useSections } from '../composables/useSections.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useFiles } from '../composables/useFiles.js';
import TreeNode from './TreeNode.js';

export default {
  name: "SectionTreeViewer",
  props: {
    selectedKeys: {
      type: Object,
      default: () => ({}),
    },
    expandedKeys: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['update:selectedKeys', 'update:expandedKeys', 'node-select', 'node-unselect'],
  setup(props, { emit }) {
    const { sections, addSection, updateSection, removeSection, reorderSections } = useSections();
    const { documents, addDocument, updateDocument } = useDocuments();
    const { uploadFiles } = useFiles();
    const fileInput = Vue.ref(null);
    const draggedNode = Vue.ref(null);
    const dropTarget = Vue.ref(null);
    const editingNodeId = Vue.ref(null);
    const newName = Vue.ref('');

    const treeNodes = Vue.computed(() => {
      console.log('Computing treeNodes with sections:', sections.value);

      const nodeMap = new Map();

      sections.value.forEach((section) => {
        nodeMap.set(section.id, {
          ...section,
          type: 'section',
          data: { ...section.data, children: [] },
        });
      });

      documents.value.forEach((doc) => {
        const sectionId = doc.data.sectionId || null;
        const docNode = {
          ...doc,
          type: 'document',
          data: { ...doc.data, children: [] },
        };
        if (nodeMap.has(sectionId)) {
          nodeMap.get(sectionId).data.children.push(docNode);
        } else if (!sectionId) {
          nodeMap.set(doc.id, docNode);
        }
      });

      const nodes = [];
      nodeMap.forEach((node) => {
        if (node.data.sectionId && nodeMap.has(node.data.sectionId)) {
          const parent = nodeMap.get(node.data.sectionId);
          parent.data.children.push(node);
          console.log(`Added node ${node.id} (${node.data.name}) as child of ${parent.id} (${parent.data.name})`);
        } else if (!node.data.sectionId) {
          nodes.push(node);
          console.log(`Added root node ${node.id} (${node.data.name})`);
        }
      });

      nodes.sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
      nodes.forEach((node) => {
        if (node.data.children.length) {
          node.data.children.sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
        }
      });

      console.log('Final treeNodes:', nodes);
      return nodes;
    });

    function getFileIcon(fileName) {
      const extension = fileName.split('.').pop().toLowerCase();
      const iconMap = {
        pdf: 'pi pi-file-pdf',
        docx: 'pi pi-file-word',
        txt: 'pi pi-file-edit',
        default: 'pi pi-file',
      };
      return iconMap[extension] || iconMap.default;
    }

    function isLeaf(node) {
      return node.type === 'document';
    }

    function isSelected(node) {
      if (isLeaf(node)) return props.selectedKeys[node.id] || false;
      return getAllChildrenSelected(node);
    }

    function isIndeterminate(node) {
      if (isLeaf(node)) return false;
      const { someSelected, allSelected } = getChildrenSelectionState(node);
      return someSelected && !allSelected;
    }

    function isExpanded(node) {
      return props.expandedKeys[node.id] || false;
    }

    function getCheckboxClasses(node) {
      return {
        'border-gray-600 bg-gray-800': !isSelected(node) && !isIndeterminate(node),
        'border-blue-500 bg-blue-500': isSelected(node) || isIndeterminate(node),
      };
    }

    function getAllChildrenSelected(node) {
      if (isLeaf(node)) return props.selectedKeys[node.id] || false;
      if (!node.data.children.length) return false;
      return node.data.children.every((child) =>
        isLeaf(child) ? props.selectedKeys[child.id] || false : getAllChildrenSelected(child)
      );
    }

    function getChildrenSelectionState(node) {
      if (isLeaf(node)) {
        const selected = props.selectedKeys[node.id] || false;
        return { someSelected: selected, allSelected: selected };
      }
      let selectedCount = 0;
      const totalLeafNodes = countLeafNodes(node);

      function countSelectedLeaves(n) {
        if (isLeaf(n)) {
          if (props.selectedKeys[n.id]) selectedCount++;
          return;
        }
        n.data.children.forEach(countSelectedLeaves);
      }

      countSelectedLeaves(node);
      return {
        someSelected: selectedCount > 0,
        allSelected: selectedCount === totalLeafNodes,
      };
    }

    function countLeafNodes(node) {
      if (isLeaf(node)) return 1;
      return node.data.children.reduce((sum, child) => sum + countLeafNodes(child), 0);
    }

    function toggleSelect(node) {
      if (isLeaf(node)) {
        if (isSelected(node)) {
          emit('node-unselect', { node, id: node.id, affectedKeys: [node.id] });
        } else {
          emit('node-select', { node, id: node.id, affectedKeys: [node.id] });
        }
      } else {
        const affectedKeys = [];
        function collectLeafKeys(n) {
          if (isLeaf(n)) affectedKeys.push(n.id);
          else n.data.children.forEach(collectLeafKeys);
        }
        collectLeafKeys(node);

        if (isSelected(node)) {
          emit('node-unselect', { node, id: node.id, affectedKeys, propagateDown: true });
        } else {
          emit('node-select', { node, id: node.id, affectedKeys, propagateDown: true });
        }
      }
    }

    function toggleExpand(node) {
      if (!isLeaf(node)) {
        if (isExpanded(node)) {
          emit('update:expandedKeys', { ...props.expandedKeys, [node.id]: false });
        } else {
          emit('update:expandedKeys', { ...props.expandedKeys, [node.id]: true });
        }
      }
    }

    const handleNodeSelect = (event) => {
      const newSelectedKeys = { ...props.selectedKeys };
      event.affectedKeys.forEach((id) => (newSelectedKeys[id] = true));
      emit('update:selectedKeys', newSelectedKeys);
      emit('node-select', event.node);
    };

    const handleNodeUnselect = (event) => {
      const newSelectedKeys = { ...props.selectedKeys };
      event.affectedKeys.forEach((id) => delete newSelectedKeys[id]);
      emit('update:selectedKeys', newSelectedKeys);
    };

    const onDragStart = (event, node) => {
      draggedNode.value = node;
      event.dataTransfer.setData('text/plain', node.id);
    };

    const onDragOver = (event, node) => {
      event.preventDefault();
      dropTarget.value = node;
    };

    const onDragLeave = () => {
      dropTarget.value = null;
    };

    const onDrop = (event, targetNode) => {
      event.preventDefault();
      if (draggedNode.value && targetNode && !isLeaf(targetNode)) {
        const sectionId = targetNode.id;
        if (draggedNode.value.data.sectionId !== sectionId) {
          updateDocument(draggedNode.value.id, draggedNode.value.data.name, sectionId);
        }
      } else if (draggedNode.value && !targetNode) {
        updateDocument(draggedNode.value.id, draggedNode.value.data.name, null);
      }
      draggedNode.value = null;
      dropTarget.value = null;
    };

    const triggerFileUpload = (sectionId = null) => {
      fileInput.value.dataset.sectionId = sectionId;
      fileInput.value.click();
    };

    const handleFileUpload = async (event) => {
      const files = event.target.files;
      const sectionId = fileInput.value.dataset.sectionId || null;
      const uuids = [];
      for (const file of files) {
        const result = await addDocument(file, sectionId);
        uuids.push(result.id);
      }
      await uploadFiles(Array.from(files), uuids);
      fileInput.value.value = '';
    };

    const startEditing = (node) => {
      editingNodeId.value = node.id;
      newName.value = node.data.name;
      Vue.nextTick(() => {
        const input = document.querySelector(`#edit-${node.id}`);
        if (input) input.focus();
      });
    };

    const finishEditing = (nodeId, updatedName) => {
      if (updatedName ) {
        updateSection(nodeId, updatedName);
      }
      editingNodeId.value = null;
      newName.value = '';
    };

    const handleAddSection = (parentId) => {
      console.log("HANDLE ADD SECTION", parentId);
      addSection("New Section", parentId);
    };

    return {
      treeNodes,
      sections,
      addSection,
      handleAddSection,
      updateSection,
      removeSection,
      reorderSections,
      isSelected,
      isIndeterminate,
      isExpanded,
      getCheckboxClasses,
      toggleSelect,
      toggleExpand,
      handleNodeSelect,
      handleNodeUnselect,
      onDragStart,
      onDragOver,
      onDragLeave,
      onDrop,
      dropTarget,
      fileInput,
      triggerFileUpload,
      handleFileUpload,
      editingNodeId,
      newName,
      startEditing,
      finishEditing,
      getFileIcon,
      isLeaf,
    };
  },
  template: `
    <div class="section-tree-viewer text-sm">
      <button @click="addSection('New Root Section')" class="mb-2 p-2 bg-blue-600 text-white rounded">
        Add Root Section
      </button>
      <div
        class="tree-container"
        @dragover="onDragOver($event, null)"
        @drop="onDrop($event, null)"
      >
        <TreeNode
          v-for="node in treeNodes"
          :key="node.id"
          :node="node"
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
          @toggle-select="toggleSelect"
          @toggle-expand="toggleExpand"
          @dragstart="onDragStart"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
          @add-section="handleAddSection"
          @start-editing="startEditing"
          @finish-editing="finishEditing"
          @remove-section="removeSection"
          @trigger-file-upload="triggerFileUpload"
        />
      </div>
      <input
        type="file"
        ref="fileInput"
        class="hidden"
        @change="handleFileUpload"
        multiple
        accept=".docx,.pdf,.pptx,.html,.txt,.js,.json,.css,.md,.xlsx"
      />
    </div>
  `,
  components: {
    TreeNode,
  },
};