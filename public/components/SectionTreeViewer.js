// components/SectionTreeViewer.js
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
          data: {
            ...section.data,
            _children: [],
            _checkStatus: props.selectedKeys[section.id] ? 'checked' : 'unchecked',
            _expanded: !!props.expandedKeys[section.id], // Use expandedKeys prop
          },
        });
      });

      documents.value.forEach((doc) => {
        const sectionId = doc.data.sectionId || null;
        const docNode = {
          ...doc,
          type: 'document',
          data: {
            ...doc.data,
            _children: [],
            _checkStatus: props.selectedKeys[doc.id] ? 'checked' : 'unchecked',
            _expanded: false,
          },
        };
        if (nodeMap.has(sectionId)) {
          nodeMap.get(sectionId).data._children.push(docNode);
        } else if (!sectionId) {
          nodeMap.set(doc.id, docNode);
        }
      });

      const nodes = [];
      nodeMap.forEach((node) => {
        if (node.data.sectionId && nodeMap.has(node.data.sectionId)) {
          const parent = nodeMap.get(node.data.sectionId);
          parent.data._children.push(node);
          console.log(`Added node ${node.id} (${node.data.name}) as child of ${parent.id} (${parent.data.name})`);
        } else if (!node.data.sectionId) {
          nodes.push(node);
          console.log(`Added root node ${node.id} (${node.data.name})`);
        }
      });

      nodes.sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
      nodes.forEach((node) => {
        if (node.data._children.length) {
          node.data._children.sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
        }
        updateCheckStatus(node);
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

    function updateCheckStatus(node) {
      if (isLeaf(node)) {
        return node.data._checkStatus === 'checked';
      }

      if (!node.data._children.length) {
        return node.data._checkStatus === 'checked';
      }

      const childStates = node.data._children.map(updateCheckStatus);
      const allChildrenChecked = childStates.every(state => state);
      const someChildrenChecked = childStates.some(state => state);

      if (allChildrenChecked) {
        node.data._checkStatus = 'checked';
      } else if (someChildrenChecked) {
        node.data._checkStatus = 'halfChecked';
      } else {
        node.data._checkStatus = 'unchecked';
      }

      return node.data._checkStatus === 'checked';
    }

    function toggleSelect(node) {
      const newSelectedKeys = { ...props.selectedKeys };
      const affectedKeys = [];

      function collectKeys(n) {
        affectedKeys.push(n.id);
        if (n.data._children) n.data._children.forEach(collectKeys);
      }

      collectKeys(node);

      const isCurrentlyChecked = node.data._checkStatus === 'checked';
      if (isCurrentlyChecked) {
        affectedKeys.forEach((id) => delete newSelectedKeys[id]);
        node.data._checkStatus = 'unchecked';
        if (!isLeaf(node)) {
          node.data._children.forEach((child) => child.data._checkStatus = 'unchecked');
        }
        emit('node-unselect', { node, id: node.id, affectedKeys, propagateDown: true });
      } else {
        affectedKeys.forEach((id) => (newSelectedKeys[id] = true));
        node.data._checkStatus = 'checked';
        if (!isLeaf(node)) {
          node.data._children.forEach((child) => child.data._checkStatus = 'checked');
        }
        emit('node-select', { node, id: node.id, affectedKeys, propagateDown: true });
      }

      let parent = node.data.sectionId ? treeNodes.value.find(n => n.id === node.data.sectionId) : null;
      while (parent) {
        updateCheckStatus(parent);
        parent = parent.data.sectionId ? treeNodes.value.find(n => n.id === parent.data.sectionId) : null;
      }

      emit('update:selectedKeys', newSelectedKeys);
    }

    function toggleExpand(node) {
      if (!isLeaf(node)) {
        const newExpandedKeys = { ...props.expandedKeys, [node.id]: !node.data._expanded };
        node.data._expanded = !node.data._expanded;
        emit('update:expandedKeys', newExpandedKeys);
      }
    }

    const handleNodeSelect = (event) => {
      toggleSelect(event.node);
    };

    const handleNodeUnselect = (event) => {
      toggleSelect(event.node);
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
      if (sectionId) {
        emit('update:expandedKeys', { ...props.expandedKeys, [sectionId]: true });
        console.log(`Auto-expanded section ${sectionId} after file upload`);
      }
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
      console.log('Finishing editing for node:', nodeId, 'New name:', updatedName);
      editingNodeId.value = null;
      newName.value = '';
    };

    const handleAddSection = (parentId) => {
      console.log("HANDLE ADD SECTION", parentId);
      addSection("New Section", parentId);
      if (parentId) {
        emit('update:expandedKeys', { ...props.expandedKeys, [parentId]: true });
        console.log(`Auto-expanded parent ${parentId} after adding section`);
      }
    };

    return {
      treeNodes,
      sections,
      addSection,
      handleAddSection,
      updateSection,
      removeSection,
      reorderSections,
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