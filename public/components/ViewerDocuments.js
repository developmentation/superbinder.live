// components/ViewerDocuments.js
import { useDocuments } from '../composables/useDocuments.js';
import { useClips } from '../composables/useClips.js';
import { useSearch } from '../composables/useSearch.js';

export default {
  name: 'ViewerDocuments',
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Search Bar -->
      <div class="p-2 bg-gray-800 border-b border-gray-700">
        <input
          v-model="searchQuery"
          @input="performSearch"
          type="text"
          class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          placeholder="Search documents (e.g., 'weather forecast Maine')..."
        />
      </div>

      <!-- Document and Search Results -->
      <div class="flex-1 overflow-auto p-4">
        <!-- Document View -->
        <div v-if="selectedDocument && !searchResults.length" class="bg-gray-700 p-4 rounded-lg">
          <div class="flex justify-between items-center mb-2">
            <span class="text-gray-300 font-semibold">{{ selectedDocument.name }}</span>
            <button
              @click="renameDocument"
              class="py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg"
            >
              Rename
            </button>
          </div>
          <div ref="docContent" v-html="renderContent(selectedDocument.processedContent)" class="prose text-gray-300"></div>
          <button
            v-if="selectedText"
            @click="clipSelectedText"
            class="mt-2 py-1 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            Clip Selected
          </button>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length" class="space-y-4">
          <div v-for="(result, index) in searchResults" :key="index" class="bg-gray-700 p-4 rounded-lg">
            <div class="flex justify-between items-center">
              <span class="text-gray-400">{{ result.documentName }}</span>
              <button
                @click="toggleExpand(index)"
                class="text-purple-400 hover:text-purple-300"
              >
                {{ expanded[index] ? 'Collapse' : 'Expand' }}
              </button>
            </div>
            <div v-if="expanded[index]" class="mt-2">
              <div v-html="highlightMatch(result.segment)" class="text-gray-300"></div>
              <div class="flex gap-2 mt-2">
                <button
                  @click="viewFullDoc(result.documentId, result.segment)"
                  class="py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg"
                >
                  View Full
                </button>
                <button
                  @click="addClip(result.segment, result.documentId)"
                  class="py-1 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center"
                >
                  <i class="pi pi-cut mr-2"></i> Clip
                </button>
              </div>
            </div>
            <div v-else class="text-gray-300 truncate">{{ result.segment.substring(0, 100) }}...</div>
          </div>
        </div>

        <div v-if="!selectedDocument && !searchResults.length" class="text-gray-400">
          Select a document or search to begin.
        </div>
      </div>
    </div>
  `,
  setup() {
    const { selectedDocument, documents, updateDocument } = useDocuments();
    const { addClip } = useClips();
    const { searchQuery, searchResults, searchDocuments } = useSearch();
    const selectedText = Vue.ref('');
    const expanded = Vue.ref({});
    const docContent = Vue.ref(null);

    function performSearch() {
      if (searchQuery.value.trim()) {
        searchDocuments(searchQuery.value);
      } else {
        searchResults.value = [];
      }
    }

    function highlightMatch(text) {
      const keywords = searchQuery.value.toLowerCase().split(/\s+/).filter(k => k);
      let highlighted = text;
      keywords.forEach(keyword => {
        const regex = new RegExp(`(${keyword})`, 'gi');
        highlighted = highlighted.replace(regex, '<span class="bg-purple-500 text-white px-1">$1</span>');
      });
      return highlighted;
    }

    function renderContent(content) {
      return content.includes('<') ? content : `<p>${content}</p>`;
    }

    function toggleExpand(index) {
      expanded.value[index] = !expanded.value[index];
      //Vue.set(expanded.value, index, !expanded.value[index]);
    }

    function viewFullDoc(docId, segment) {
      const doc = documents.value.find(d => d.id === docId);
      if (doc) {
        selectedDocument.value = doc;
        Vue.nextTick(() => {
          const contentEl = docContent.value;
          if (contentEl) {
            const matchIndex = doc.processedContent.indexOf(segment);
            if (matchIndex >= 0) {
              contentEl.scrollTop = matchIndex / doc.processedContent.length * contentEl.scrollHeight;
            }
          }
        });
      }
    }

    function clipSelectedText() {
      if (selectedText.value && selectedDocument.value) {
        addClip(selectedText.value, selectedDocument.value.id);
        selectedText.value = '';
      }
    }


    function renameDocument() {
      if (selectedDocument.value) {
        const newName = prompt('Enter new document name:', selectedDocument.value.name);
        if (newName && newName.trim()) {
          updateDocument(selectedDocument.value.id, newName.trim());
        }
      }
    }

    function handleSelectionChange() {
      const selection = window.getSelection();
      if (selection.rangeCount && docContent.value && docContent.value.contains(selection.anchorNode)) {
        selectedText.value = selection.toString().trim();
      } else {
        selectedText.value = '';
      }
    }

    Vue.onMounted(() => {
      const checkAndAddListener = () => {
        if (docContent.value) {
          document.removeEventListener('selectionchange', handleSelectionChange);
          document.addEventListener('selectionchange', handleSelectionChange);
        } else {
          Vue.nextTick(() => {
            setTimeout(checkAndAddListener, 100);
          });
        }
      };
      checkAndAddListener();
    });

    Vue.onUnmounted(() => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    });

    return {
      selectedDocument,
      documents,
      searchQuery,
      searchResults,
      expanded,
      docContent,
      selectedText,
      performSearch,
      highlightMatch,
      renderContent,
      toggleExpand,
      viewFullDoc,
      addClip,
      clipSelectedText,
      renameDocument,
    };
  },
};