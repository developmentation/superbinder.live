// components/SectionTreeViewer.js
import { useSections } from '../composables/useSections.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useArtifacts } from '../composables/useArtifacts.js';
import { useFiles } from '../composables/useFiles.js';
import { rasterizePDF } from '../utils/files/processorPDF.js';
import TreeNode from './TreeNode.js';

export default {
  name: "SectionTreeViewer",
  props: {
    selectedKeys: { type: Object, default: () => ({}) },
    expandedKeys: { type: Object, default: () => ({}) },
  },
  emits: ['update:selectedKeys', 'update:expandedKeys', 'node-select', 'node-unselect', 'upload-files'],
  setup(props, { emit }) {
    const { sections, addSection, updateSection, removeSection, reorderSections } = useSections();
    const { documents, updateDocument } = useDocuments();
    const { artifacts, updateArtifact, setSelectedArtifact } = useArtifacts();
    const { files } = useFiles(); // Remove uploadFiles, retrieveFiles as they're not used here anymore
    const fileInput = Vue.ref(null);
    const draggedNode = Vue.ref(null);
    const dropTarget = Vue.ref(null);
    const editingNodeId = Vue.ref(null);

    const treeNodes = Vue.computed(() => {
      const nodeMap = new Map();
      sections.value.forEach((section) => {
        nodeMap.set(section.id, {
          ...section,
          type: 'section',
          data: {
            ...section.data,
            name: section.data.name || 'Unnamed Section',
            _children: [],
            _checkStatus: props.selectedKeys[section.id] ? 'checked' : 'unchecked',
            _expanded: !!props.expandedKeys[section.id],
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
            name: doc.data.name || `Document ${doc.id.slice(0, 8)}`,
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

      artifacts.value.forEach((artifact) => {
        const sectionId = artifact.data.sectionId || null;
        const artifactNode = {
          ...artifact,
          type: 'artifact',
          data: {
            ...artifact.data,
            name: artifact.data.name || `Artifact ${artifact.id.slice(0, 8)}`,
            _children: [],
            _checkStatus: props.selectedKeys[artifact.id] ? 'checked' : 'unchecked',
            _expanded: false,
          },
        };
        if (nodeMap.has(sectionId)) {
          nodeMap.get(sectionId).data._children.push(artifactNode);
        } else if (!sectionId) {
          nodeMap.set(artifact.id, artifactNode);
        }
      });

      const nodes = [];
      nodeMap.forEach((node) => {
        if (node.data.sectionId && nodeMap.has(node.data.sectionId)) {
          const parent = nodeMap.get(node.data.sectionId);
          parent.data._children.push(node);
        } else if (!node.data.sectionId) {
          nodes.push(node);
        }
      });

      nodes.sort((a, b) => {
        if (a.type === 'section' && b.type === 'section') {
          return (a.data.order || 0) - (b.data.order || 0);
        }
        if (a.type !== 'section' && b.type !== 'section') {
          return a.data.name.localeCompare(b.data.name);
        }
        return a.type === 'section' ? -1 : 1;
      });

      nodes.forEach((node) => {
        if (node.data._children.length) {
          node.data._children.sort((a, b) => a.data.name.localeCompare(b.data.name));
        }
        updateCheckStatus(node);
      });

      return nodes;
    });

    function getFileIcon(fileName) {
      if (!fileName || typeof fileName !== 'string') return 'pi pi-file';
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      const iconMap = {
        pdf: 'pi pi-file-pdf',
        docx: 'pi pi-file-word',
        txt: 'pi pi-file-edit',
        default: 'pi pi-file',
      };
      return iconMap[extension] || iconMap.default;
    }

    function isLeaf(node) {
      return node.type === 'document' || node.type === 'artifact';
    }

    function updateCheckStatus(node) {
      if (isLeaf(node)) return node.data._checkStatus === 'checked';
      if (!node.data._children.length) return node.data._checkStatus === 'checked';
      const childStates = node.data._children.map(updateCheckStatus);
      const allChecked = childStates.every(state => state);
      const someChecked = childStates.some(state => state);
      node.data._checkStatus = allChecked ? 'checked' : someChecked ? 'halfChecked' : 'unchecked';
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

      const isChecked = node.data._checkStatus === 'checked';
      if (isChecked) {
        affectedKeys.forEach(id => delete newSelectedKeys[id]);
        node.data._checkStatus = 'unchecked';
        if (!isLeaf(node)) node.data._children.forEach(child => child.data._checkStatus = 'unchecked');
        emit('node-unselect', { node, id: node.id, affectedKeys, propagateDown: true });
      } else {
        affectedKeys.forEach(id => (newSelectedKeys[id] = true));
        node.data._checkStatus = 'checked';
        if (!isLeaf(node)) node.data._children.forEach(child => child.data._checkStatus = 'checked');
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

    const handleNodeSelect = (node) => {
      if (isLeaf(node)) emit('node-select', node);
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
          if (draggedNode.value.type === 'document') {
            updateDocument(draggedNode.value.id, { name: draggedNode.value.data.name, sectionId });
          } else if (draggedNode.value.type === 'artifact') {
            updateArtifact(draggedNode.value.id, { name: draggedNode.value.data.name, sectionId });
          }
        }
      } else if (draggedNode.value && !targetNode) {
        if (draggedNode.value.type === 'document') {
          updateDocument(draggedNode.value.id, { name: draggedNode.value.data.name, sectionId: null });
        } else if (draggedNode.value.type === 'artifact') {
          updateArtifact(draggedNode.value.id, { name: draggedNode.value.data.name, sectionId: null });
        }
      }
      draggedNode.value = null;
      dropTarget.value = null;
    };

    const triggerFileUpload = (sectionId = null) => {
      fileInput.value.dataset.sectionId = sectionId;
      fileInput.value.click();
    };

    const handleFileUpload = (event) => {
      const sectionId = fileInput.value.dataset.sectionId || null;
      emit('upload-files', event, sectionId); // Emit event to ViewerSections
      fileInput.value.value = ''; // Reset input
      if (sectionId) {
        emit('update:expandedKeys', { ...props.expandedKeys, [sectionId]: true });
      }
    };

    const startEditing = (node) => {
      console.log('SectionTreeViewer startEditing:', { id: node.id, type: node.type, name: node.data.name });
      editingNodeId.value = node.id;
      Vue.nextTick(() => {
        const input = document.querySelector(`#edit-${node.id}`);
        if (input) input.focus();
      });
    };

    const finishEditing = (node) => {
      const updatedName = node.data.name;
      console.log('SectionTreeViewer finishEditing:', {
        id: node.id,
        type: node.type,
        originalName: treeNodes.value.find(n => n.id === node.id)?.data.name || documents.value.find(d => d.id === node.id)?.data.name || artifacts.value.find(a => a.id === node.id)?.data.name,
        updatedName,
        sectionId: node.data.sectionId,
      });

      if (updatedName && updatedName.trim() && updatedName.trim() !== (treeNodes.value.find(n => n.id === node.id)?.data.name || documents.value.find(d => d.id === node.id)?.data.name || artifacts.value.find(a => a.id === node.id)?.data.name)) {
        if (node.type === 'section') {
          console.log(`Updating section with id ${node.id} to name ${updatedName.trim()}`);
          updateSection(node.id, updatedName.trim());
        } else if (node.type === 'document') {
          console.log(`Updating document with id ${node.id} to name ${updatedName.trim()}, sectionId: ${node.data.sectionId}`);
          updateDocument(node.id, { name: updatedName.trim(), sectionId: node.data.sectionId });
        } else if (node.type === 'artifact') {
          console.log(`Updating artifact with id ${node.id} to name ${updatedName.trim()}, sectionId: ${node.data.sectionId}`);
          updateArtifact(node.id, { name: updatedName.trim(), sectionId: node.data.sectionId });
        } else {
          console.error(`Unknown node type: ${node.type} for node id ${node.id}`);
        }
      } else {
        console.log('No update performed: name unchanged or invalid');
      }
      editingNodeId.value = null;
    };

    const handleAddSection = (parentId) => {
      addSection("New Section", parentId);
      if (parentId) {
        emit('update:expandedKeys', { ...props.expandedKeys, [parentId]: true });
      }
    };

    const handleRenderFile = async (id) => {
      const doc = documents.value.find(d => d.id === id);
      const artifact = artifacts.value.find(a => a.id === id);

      const imageTypes = ['png', 'jpg', 'jpeg', 'webp'];

      if (doc && (doc.data.type === 'pdf' || imageTypes.includes(doc.data.type) || doc.data.type === 'svg')) {
        try {
          if (!files.value[id]) {
            await retrieveFiles([id]);
          }
          const file = files.value[id];
          if (file && file.data) {
            if (doc.data.type === 'pdf') {
              const { pages } = await rasterizePDF(file.data);
              doc.data.pages = pages;
              doc.data.status = 'complete';
              documents.value = [...documents.value];
              updateDocument(id, { status: 'complete' });
            } else if (imageTypes.includes(doc.data.type) || doc.data.type === 'svg') {
              const blob = new Blob([file.data], { type: doc.data.mimeType });
              const url = URL.createObjectURL(blob);
              doc.data.pages = [url];
              doc.data.status = 'complete';
              documents.value = [...documents.value];
              updateDocument(id, { status: 'complete' });
            }
            emit('node-select', doc);
          }
        } catch (error) {
          console.error(`Error rendering document ${id}:`, error);
        }
      } else if (artifact) {
        setSelectedArtifact(artifact);
        emit('node-select', artifact);
      } else if (doc) {
        emit('node-select', doc);
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
      onDragStart,
      onDragOver,
      onDragLeave,
      onDrop,
      dropTarget,
      fileInput,
      triggerFileUpload,
      handleFileUpload,
      editingNodeId,
      startEditing,
      finishEditing,
      handleRenderFile,
      getFileIcon,
      isLeaf,
    };
  },
  template: `
    <div class="section-tree-viewer text-sm">
      <div class="tree-container" @dragover="onDragOver($event, null)" @drop="onDrop($event, null)">
        <TreeNode
          v-for="node in treeNodes"
          :key="node.id"
          :node="node"
          :selected-keys="selectedKeys"
          :expanded-keys="expandedKeys"
          :editing-node-id="editingNodeId"
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
          @render-file="handleRenderFile"
          @node-select="handleNodeSelect"
        />
      </div>
      <input
        type="file"
        ref="fileInput"
        class="hidden"
        @change="handleFileUpload"
        multiple
        accept=".docx,.pdf,.pptx,.html,.txt,.js,.json,.css,.md,.xlsx,.png,.jpg,.jpeg,.webp,.svg"
      />
    </div>
  `,
  components: { TreeNode },
};