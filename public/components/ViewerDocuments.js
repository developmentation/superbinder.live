import { useDocuments } from "../composables/useDocuments.js";
import { useClips } from "../composables/useClips.js";
import { useSearch } from "../composables/useSearch.js";

export default {
  name: "ViewerDocuments",
  props: {
    documents: {
      type: Array,
      default: () => [],
    },
    bookmarks: {
      type: Array,
      default: () => [],
    },
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Search Bar -->
      <div class="p-2 bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <input
          v-model="searchQuery"
          @input="performSearch"
          type="text"
          class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          placeholder="Search documents (e.g., 'weather forecast Maine')..."
        />
      </div>

      <!-- Document and Search Results -->
      <div class="flex-1 overflow-y-auto p-4 relative" style="max-height: calc(100vh - 100px);">
        <!-- Document View -->
        <div v-if="selectedDocument && !searchResults.length" class="bg-gray-700 p-4 rounded-lg h-full">
          <div class="flex justify-between items-center mb-2">
            <span class="text-gray-400">{{ selectedDocument.name }}</span>
            <button
              v-if="selectedPageIndex !== null"
              @click="addBookmarkLocal"
              class="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Bookmark Page
            </button>
          </div>
          <div
            v-if="selectedDocument.renderAsHtml"
            ref="docContent"
            v-html="selectedDocument.processedContent"
            class="prose text-gray-300 pdf-viewer"
            @contextmenu="handleContextMenu"
            @click="handlePageSelection"
          ></div>
          <pre
            v-else
            ref="docContent"
            class="text-gray-300 whitespace-pre-wrap"
            @contextmenu="handleContextMenu"
          >{{ selectedDocument.processedContent }}</pre>
          <div class="mt-2 flex gap-2">
            <button
              v-if="selectedText"
              @click="clipSelectedText"
              class="py-1 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Clip Selected
            </button>
            <button
              v-if="selectedText && !selectedDocument.renderAsHtml"
              @click="addTextBookmark"
              class="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Bookmark Selection
            </button>
          </div>
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
                  @click="viewFullDoc(result.id, result.segment)"
                  class="py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg"
                >
                  View Full
                </button>
                <button
                  @click="addClip(result.segment, result.id)"
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

        <!-- Context Menu -->
        <div
          v-if="showContextMenu"
          :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
          class="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20"
          @click.stop
        >
          <div
            v-if="contextMenuOptions.includes('Create Bookmark')"
            class="px-4 py-2 text-white hover:bg-gray-700 cursor-pointer"
            @click="addBookmarkFromContext"
          >
            Create Bookmark
          </div>
          <div
            v-if="contextMenuOptions.includes('Create Clip')"
            class="px-4 py-2 text-white hover:bg-gray-700 cursor-pointer"
            @click="clipSelectedTextFromContext"
          >
            Create Clip
          </div>
        </div>
      </div>
    </div>
  `,
  setup(props) {
    const { selectedDocument, documents, updateDocument, setDocuments, setSelectedDocument } = useDocuments();
    const { addClip, addBookmark } = useClips();
    const { searchQuery, searchResults, searchDocuments } = useSearch();
    const selectedText = Vue.ref("");
    const selectedPageIndex = Vue.ref(null);
    const expanded = Vue.ref({});
    const docContent = Vue.ref(null);
    const showContextMenu = Vue.ref(false);
    const contextMenuX = Vue.ref(0);
    const contextMenuY = Vue.ref(0);
    const contextMenuOptions = Vue.ref([]);
    const storedSelection = Vue.ref(null);

    Vue.onMounted(() => {
      if (props.documents && props.documents.length > 0) {
        setDocuments(props.documents);
      }
      document.addEventListener('click', hideContextMenu);
    });

    Vue.watch(
      () => props.documents,
      (newDocuments) => {
        if (newDocuments && newDocuments.length > 0) {
          setDocuments(newDocuments);
        }
      },
      { deep: true }
    );

    Vue.onUnmounted(() => {
      document.removeEventListener('click', hideContextMenu);
      document.removeEventListener("selectionchange", handleSelectionChange);
    });

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
        const regex = new RegExp(`(${keyword})`, "gi");
        highlighted = highlighted.replace(regex, '<span class="bg-purple-500 text-white px-1">$1</span>');
      });
      return highlighted;
    }

    function toggleExpand(index) {
      expanded.value[index] = !expanded.value[index];
    }

    function viewFullDoc(docId, segment) {
      const doc = documents.value.find(d => d.id === docId);
      if (doc) {
        setSelectedDocument(doc);
        Vue.nextTick(() => {
          const contentEl = docContent.value;
          if (contentEl) {
            const matchIndex = doc.processedContent.indexOf(segment);
            if (matchIndex >= 0) {
              const scrollContainer = contentEl.closest('.flex-1.overflow-y-auto');
              if (scrollContainer) {
                scrollContainer.scrollTop = matchIndex / doc.processedContent.length * scrollContainer.scrollHeight;
              } else {
                console.warn('Scroll container not found for viewFullDoc');
              }
            }
          }
        });
      }
    }

    function clipSelectedText() {
      if (selectedText.value && selectedDocument.value) {
        const contentEl = docContent.value;
        const offset = contentEl.innerText.indexOf(selectedText.value);
        const location = selectedDocument.value.renderAsHtml ? 
          { pageIndex: selectedPageIndex.value } : 
          { offset };
        addClip(selectedText.value, selectedDocument.value.id, location);
        selectedText.value = "";
      }
    }

    function clipSelectedTextFromContext() {
      if (storedSelection.value && storedSelection.value.text && selectedDocument.value) {
        console.log('clipSelectedTextFromContext:', storedSelection.value);
        addClip(storedSelection.value.text, selectedDocument.value.id, storedSelection.value.location);
        storedSelection.value = null;
      }
      hideContextMenu();
    }

    function handleSelectionChange() {
      const selection = window.getSelection();
      if (selection.rangeCount && docContent.value && docContent.value.contains(selection.anchorNode)) {
        selectedText.value = selection.toString().trim();
      } else {
        selectedText.value = "";
      }
    }

    function handlePageSelection(event) {
      if (selectedDocument.value.type === "pdf") {
        const pageDiv = event.target.closest(".pdf-page");
        if (pageDiv) {
          const allPages = docContent.value.querySelectorAll(".pdf-page");
          allPages.forEach(page => page.classList.remove("selected"));
          pageDiv.classList.add("selected");
          const pageIndex = Array.from(allPages).indexOf(pageDiv);
          selectedPageIndex.value = pageIndex >= 0 ? pageIndex : null;
        } else {
          selectedPageIndex.value = null;
          docContent.value.querySelectorAll(".pdf-page").forEach(page => page.classList.remove("selected"));
        }
      }
    }

    function handleContextMenu(event) {
      event.preventDefault();
      if (!selectedDocument.value) return;

      const selection = window.getSelection();
      const hasTextSelection = selection.toString().trim().length > 0 && docContent.value.contains(selection.anchorNode);
      const pageDiv = selectedDocument.value.type === "pdf" ? event.target.closest(".pdf-page") : null;

      if (!hasTextSelection && !pageDiv) return;

      contextMenuOptions.value = [];
      storedSelection.value = null;

      if (pageDiv) {
        const allPages = docContent.value.querySelectorAll(".pdf-page");
        const pageIndex = Array.from(allPages).indexOf(pageDiv);
        selectedPageIndex.value = pageIndex >= 0 ? pageIndex : null;
        contextMenuOptions.value.push("Create Bookmark");
        if (hasTextSelection) {
          const text = selection.toString().trim();
          storedSelection.value = { text, location: { pageIndex: selectedPageIndex.value } };
          contextMenuOptions.value.push("Create Clip");
        }
      } else if (hasTextSelection) {
        const contentEl = docContent.value;
        const offset = contentEl.innerText.indexOf(selection.toString().trim());
        storedSelection.value = { text: selection.toString().trim(), location: { offset } };
        contextMenuOptions.value.push("Create Clip");
        if (!selectedDocument.value.renderAsHtml) contextMenuOptions.value.push("Create Bookmark");
      }

      const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
      const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
      contextMenuX.value = event.clientX - scrollLeft;
      contextMenuY.value = event.clientY + scrollTop;

      const menuWidth = 150;
      const menuHeight = contextMenuOptions.value.length * 40;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (contextMenuX.value + menuWidth > viewportWidth) {
        contextMenuX.value = viewportWidth - menuWidth;
      }
      if (contextMenuY.value + menuHeight > viewportHeight) {
        contextMenuY.value = viewportHeight - menuHeight;
      }

      showContextMenu.value = true;
    }

    function addBookmarkLocal() {
      if (selectedDocument.value && selectedPageIndex.value !== null) {
        addBookmark({
          documentId: selectedDocument.value.id,
          pageIndex: selectedPageIndex.value,
          type: "pdf-page",
          name: `${selectedDocument.value.name} - Page ${selectedPageIndex.value + 1}`,
        });
        selectedPageIndex.value = null;
        docContent.value.querySelectorAll(".pdf-page").forEach(page => page.classList.remove("selected"));
      }
    }

    function addBookmarkFromContext() {
      addBookmarkLocal();
      hideContextMenu();
    }

    function addTextBookmark() {
      if (selectedText.value && selectedDocument.value) {
        const contentEl = docContent.value;
        const offset = contentEl.innerText.indexOf(selectedText.value);
        addBookmark({
          documentId: selectedDocument.value.id,
          text: selectedText.value,
          offset: offset,
          type: "text",
          name: `${selectedDocument.value.name} - Text Selection`,
        });
        selectedText.value = "";
      }
    }

    function hideContextMenu() {
      showContextMenu.value = false;
    }

    Vue.onMounted(() => {
      const checkAndAddListener = () => {
        if (docContent.value) {
          document.removeEventListener("selectionchange", handleSelectionChange);
          document.addEventListener("selectionchange", handleSelectionChange);
        } else {
          Vue.nextTick(() => {
            setTimeout(checkAndAddListener, 100);
          });
        }
      };
      checkAndAddListener();
    });

    return {
      selectedDocument,
      documents,
      searchQuery,
      searchResults,
      expanded,
      docContent,
      selectedText,
      selectedPageIndex,
      showContextMenu,
      contextMenuX,
      contextMenuY,
      contextMenuOptions,
      performSearch,
      highlightMatch,
      toggleExpand,
      viewFullDoc,
      addClip,
      clipSelectedText,
      addBookmarkLocal,
      addTextBookmark,
      handlePageSelection,
      handleContextMenu,
      addBookmarkFromContext,
      clipSelectedTextFromContext,
    };
  },
};