// components/ViewerDocuments.js
import { useDocuments } from "../composables/useDocuments.js";
import { useClips } from "../composables/useClips.js";
import { useSearch } from "../composables/useSearch.js";
import { useScrollNavigation } from "../composables/useScrollNavigation.js";
import LazyScrollViewer from "./LazyScrollViewer.js";
import ViewerBookmarks from "./ViewerBookmarks.js";

export default {
  name: "ViewerDocuments",
  components: {
    LazyScrollViewer,
    ViewerBookmarks,
  },
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
  setup(props) {
    const { selectedDocument, documents, setSelectedDocument } = useDocuments();
    const { addClip, addBookmark } = useClips();
    const { searchQuery, searchResults, searchDocuments } = useSearch();
    const {
      onScrollRequest,
      requestScrollToPage,
      cleanup: cleanupScrollNavigation,
      jumpToPageNumber,
    } = useScrollNavigation();
    const selectedText = Vue.ref("");
    const selectedPageIndex = Vue.ref(null);
    const expanded = Vue.ref({});
    const docContent = Vue.ref(null);
    const lazyScrollViewer = Vue.ref(null);
    const scrollContainer = Vue.ref(null);
    const showContextMenu = Vue.ref(false);
    const contextMenuX = Vue.ref(0);
    const contextMenuY = Vue.ref(0);
    const contextMenuOptions = Vue.ref([]);
    const storedSelection = Vue.ref(null);
    const pageItems = Vue.ref([]);
    const jumpToPageInput = Vue.ref("");

    const isPdf = Vue.computed(() => {
      return (
        selectedDocument.value &&
        selectedDocument.value.data &&
        selectedDocument.value.data.type === "pdf"
      );
    });

    const scrollToPage = (pageIndex, attempt = 1) => {
      if (lazyScrollViewer.value && pageItems.value.length > pageIndex) {
        console.log(
          `Calling scrollToPage for index: ${pageIndex} (Attempt ${attempt})`
        );
        lazyScrollViewer.value.scrollToPage(pageIndex);
        selectedPageIndex.value = pageIndex;
      } else if (attempt < 5) {
        console.log(`Scroll attempt ${attempt}/5 failed, retrying...`);
        setTimeout(() => scrollToPage(pageIndex, attempt + 1), 100);
      } else {
        console.error(
          `Scroll failed after 5 attempts: lazyScrollViewer=${!!lazyScrollViewer.value}, pageIndex=${pageIndex}, pages=${pageItems.value.length}`
        );
      }
    };

    const jumpToPage = () => {
      const pageNum = parseInt(jumpToPageInput.value, 10);
      if (isNaN(pageNum)) {
        console.error("Invalid page number entered:", jumpToPageInput.value);
        jumpToPageInput.value = "";
        return;
      }
      const pageIndex = pageNum - 1;
      const maxPages = selectedDocument.value?.data?.pages?.length || 0;
      if (pageIndex >= 0 && pageIndex < maxPages) {
        console.log(
          `Jumping to page index: ${pageIndex} (1-based: ${pageNum})`
        );
        scrollToPage(pageIndex);
        jumpToPageInput.value = "";
      } else {
        console.error(
          `Invalid page number: ${pageNum}. Must be between 1 and ${maxPages}`
        );
        jumpToPageInput.value = "";
      }
    };

    Vue.onMounted(() => {
      if (jumpToPageNumber.value) {
        jumpToPageInput.value = jumpToPageNumber.value;
        jumpToPage();
      }
      onScrollRequest((pageIndex) => {
        console.log(`Received scroll request for page index: ${pageIndex}`);
        selectedPageIndex.value = pageIndex;
        scrollToPage(pageIndex);
      });
    });

    Vue.watch(
      () => jumpToPageNumber.value,
      (newVal) => {
        jumpToPageInput.value = newVal;
        jumpToPage();
      },
      { immediate: true }
    );

    Vue.watch(
      () => selectedDocument.value,
      (newDoc) => {
        if (
          newDoc &&
          newDoc.data &&
          newDoc.data.type === "pdf" &&
          newDoc.data.pages
        ) {
          pageItems.value = newDoc.data.pages;
          Vue.nextTick(() => {
            console.log(
              `LazyScrollViewer initialized: ${!!lazyScrollViewer.value}, Pages: ${pageItems.value.length}`
            );
            if (selectedPageIndex.value !== null) {
              console.log(
                `Triggering queued scroll to: ${selectedPageIndex.value}`
              );
              scrollToPage(selectedPageIndex.value);
            }
          });
        } else {
          pageItems.value = [];
        }
      },
      { immediate: true }
    );

    Vue.watch(
      () => pageItems.value,
      (newPages) => {
        if (newPages.length && selectedPageIndex.value !== null) {
          console.log(
            `Page items loaded, triggering scroll to: ${selectedPageIndex.value}`
          );
          scrollToPage(selectedPageIndex.value);
        }
      },
      { immediate: true }
    );

    Vue.onMounted(() => {
      if (props.documents && props.documents.length > 0) {
        documents.value = props.documents.map((doc) => ({
          id: doc.id,
          userUuid: doc.userUuid,
          data: { ...doc.data, type: doc.data.type || doc.type || "unknown" },
        }));
      }
      document.addEventListener("click", hideContextMenu);
      const checkAndAddListener = () => {
        if (docContent.value || scrollContainer.value) {
          document.removeEventListener(
            "selectionchange",
            handleSelectionChange
          );
          document.addEventListener("selectionchange", handleSelectionChange);
        } else {
          Vue.nextTick(() => setTimeout(checkAndAddListener, 100));
        }
      };
      checkAndAddListener();
    });

    Vue.watch(
      () => props.documents,
      (newDocuments) => {
        if (newDocuments && newDocuments.length > 0) {
          documents.value = newDocuments.map((doc) => ({
            id: doc.id,
            userUuid: doc.userUuid,
            data: { ...doc.data, type: doc.data.type || doc.type || "unknown" },
          }));
        }
      },
      { deep: true }
    );

    Vue.onUnmounted(() => {
      document.removeEventListener("click", hideContextMenu);
      document.removeEventListener("selectionchange", handleSelectionChange);
      cleanupScrollNavigation();
    });

    const performSearch = () => {
      if (searchQuery.value.trim()) {
        searchDocuments(searchQuery.value, documents.value);
      } else {
        searchResults.value = [];
      }
    };

    const highlightMatch = (text) => {
      const keywords = searchQuery.value
        .toLowerCase()
        .split(/\s+/)
        .filter((k) => k);
      let highlighted = text;
      keywords.forEach((keyword) => {
        const regex = new RegExp(`(${keyword})`, "gi");
        highlighted = highlighted.replace(
          regex,
          '<span class="bg-purple-500 text-white px-1">$1</span>'
        );
      });
      return highlighted;
    };

    const toggleExpand = (index) => {
      expanded.value[index] = !expanded.value[index];
    };

    const viewFullDoc = (docId, segment) => {
      const doc = documents.value.find((d) => d.id === docId);
      if (doc) {
        setSelectedDocument(doc);
        Vue.nextTick(() => {
          if (doc.data.type === "pdf" && doc.data.pages) {
            const pageIndex = doc.data.pages.findIndex((page) =>
              page.includes(segment)
            );
            if (pageIndex >= 0) {
              selectedPageIndex.value = pageIndex;
              scrollToPage(pageIndex);
            }
          } else if (docContent.value) {
            const matchIndex = doc.data.processedContent.indexOf(segment);
            if (matchIndex >= 0) {
              const scrollContainer = docContent.value.closest(
                ".flex-1.overflow-y-auto"
              );
              if (scrollContainer) {
                scrollContainer.scrollTop =
                  (matchIndex / doc.data.processedContent.length) *
                  scrollContainer.scrollHeight;
              }
            }
          }
        });
      }
    };

    const clipSelectedText = () => {
      if (selectedText.value && selectedDocument.value) {
        const contentEl =
          docContent.value || document.querySelector(".pdf-page");
        const location =
          isPdf.value && selectedPageIndex.value !== null
            ? { pageIndex: selectedPageIndex.value }
            : { offset: contentEl?.innerText.indexOf(selectedText.value) || 0 };
        addClip(selectedText.value, selectedDocument.value.id, location);
        selectedText.value = "";
      }
    };

    const clipSelectedTextFromContext = () => {
      if (
        storedSelection.value &&
        storedSelection.value.text &&
        selectedDocument.value
      ) {
        addClip(
          storedSelection.value.text,
          selectedDocument.value.id,
          storedSelection.value.location
        );
        storedSelection.value = null;
      }
      hideContextMenu();
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (
        selection.rangeCount &&
        (docContent.value || scrollContainer.value) &&
        (docContent.value?.contains(selection.anchorNode) ||
          scrollContainer.value?.contains(selection.anchorNode))
      ) {
        selectedText.value = selection.toString().trim();
      } else {
        selectedText.value = "";
      }
    };

    const handleContextMenu = (event, pageIndex = null) => {
      event.preventDefault();
      if (!selectedDocument.value) return;

      const selection = window.getSelection();
      const hasTextSelection =
        selection.toString().trim().length > 0 &&
        (docContent.value?.contains(selection.anchorNode) ||
          scrollContainer.value?.contains(selection.anchorNode));
      const pageDiv = isPdf.value ? event.target.closest(".pdf-page") : null;

      if (!hasTextSelection && !pageDiv && !isPdf.value) return;

      contextMenuOptions.value = [];
      storedSelection.value = null;

      if (pageDiv && isPdf.value) {
        selectedPageIndex.value = pageIndex;
        contextMenuOptions.value.push("Create Bookmark");
        if (hasTextSelection) {
          const text = selection.toString().trim();
          storedSelection.value = {
            text,
            location: { pageIndex: selectedPageIndex.value },
          };
          contextMenuOptions.value.push("Create Clip");
        }
      } else if (hasTextSelection && !isPdf.value) {
        const contentEl = docContent.value;
        const offset = contentEl.innerText.indexOf(selection.toString().trim());
        storedSelection.value = {
          text: selection.toString().trim(),
          location: { offset },
        };
        contextMenuOptions.value.push("Create Clip");
        contextMenuOptions.value.push("Create Bookmark");
      }

      const scrollContainer = document.querySelector(".flex-1.overflow-y-auto");
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
    };

    const addBookmarkLocal = () => {
      if (
        selectedDocument.value &&
        isPdf.value &&
        selectedPageIndex.value !== null
      ) {
        const pageNumber = selectedPageIndex.value + 1;
        addBookmark({
          documentId: selectedDocument.value.id,
          pageIndex: selectedPageIndex.value,
          type: "pdf-page",
          name: `${selectedDocument.value.data.name} - Page ${pageNumber}`,
        });
        selectedPageIndex.value = null;
      }
    };

    const addBookmarkFromContext = () => {
      addBookmarkLocal();
      hideContextMenu();
    };

    const addTextBookmark = () => {
      if (selectedText.value && selectedDocument.value && !isPdf.value) {
        const contentEl = docContent.value;
        const offset = contentEl.innerText.indexOf(selectedText.value);
        addBookmark({
          documentId: selectedDocument.value.id,
          text: selectedText.value,
          offset: offset,
          type: "text",
          name: `${selectedDocument.value.data.name} - Text Selection`,
        });
        selectedText.value = "";
      }
    };

    const hideContextMenu = () => {
      showContextMenu.value = false;
    };

    const handleScroll = (scrollTop) => {
      if (!lazyScrollViewer.value || !pageItems.value.length) return;
      const pageHeight = lazyScrollViewer.value.firstPageHeight || 1170;
      const centerIndex = Math.floor(
        (scrollTop + window.innerHeight / 2) / pageHeight
      );
      if (centerIndex >= 0 && centerIndex < pageItems.value.length) {
        selectedPageIndex.value = centerIndex;
      }
    };

    const updateTab = (tabName, viewerType, data) => {
      console.log(`Update tab: ${tabName}, ${viewerType}`, data);
    };

    return {
      selectedDocument,
      documents,
      searchQuery,
      searchResults,
      expanded,
      docContent,
      lazyScrollViewer,
      scrollContainer,
      selectedText,
      selectedPageIndex,
      showContextMenu,
      contextMenuX,
      contextMenuY,
      contextMenuOptions,
      isPdf,
      pageItems,
      jumpToPageInput,
      performSearch,
      highlightMatch,
      toggleExpand,
      viewFullDoc,
      addClip,
      clipSelectedText,
      addBookmarkLocal,
      addTextBookmark,
      handleContextMenu,
      addBookmarkFromContext,
      clipSelectedTextFromContext,
      handleScroll,
      jumpToPage,
      updateTab,
    };
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
        <!-- Document Viewer (Left Column) -->
        <div class="flex-1 md:w-1/2 overflow-hidden relative" ref="scrollContainer">
          <div v-if="isPdf && selectedDocument.data.pages" class="p-2 bg-gray-800 border-b border-gray-700 sticky top-0 z-20 flex items-center gap-2">
            <span class="text-gray-400">Page:</span>
            <input
              type="text"
              inputmode="numeric"
              v-model="jumpToPageInput"
              @keyup.enter="jumpToPage"
              class="w-16 p-1 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none appearance-none"
              :placeholder="'1-' + selectedDocument.data.pages.length"
            />
            <span class="text-gray-400">of {{ selectedDocument.data.pages.length }}</span>
            <button
              @click="jumpToPage"
              class="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Go
            </button>
          </div>
          <div class="h-full overflow-y-auto">
            <div v-if="selectedDocument && !searchResults.length" class="bg-gray-700 p-4 rounded-lg h-full">
              <div class="flex justify-between items-center mb-2">
                <span class="text-gray-400">{{ selectedDocument.data.name }}</span>
              </div>
              <lazy-scroll-viewer
                v-show="isPdf && selectedDocument.data.pages"
                ref="lazyScrollViewer"
                :pages="pageItems"
                :buffer="1"
                class="pdf-viewer"
                @scroll="handleScroll"
                @contextmenu="handleContextMenu"
              />
              <div
                v-show="!isPdf"
                ref="docContent"
                v-html="selectedDocument.data.processedContent"
                class="prose text-gray-300 h-full overflow-y-auto"
                @contextmenu="handleContextMenu"
              ></div>
              <div class="mt-2 flex gap-2">
                <button
                  v-if="selectedText"
                  @click="clipSelectedText"
                  class="py-1 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  Clip Selected
                </button>
                <button
                  v-if="selectedText && !isPdf"
                  @click="addTextBookmark"
                  class="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Bookmark Selection
                </button>
              </div>
            </div>
            <div v-if="searchResults.length" class="space-y-4 h-full overflow-y-auto">
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
            <div v-if="!selectedDocument && !searchResults.length" class="text-gray-400 h-full flex items-center justify-center">
              Select a document or search to begin.
            </div>
          </div>
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
        <!-- Bookmarks (Right Column) -->
        <div class="hidden md:block md:w-1/2 border-l border-gray-700 h-full overflow-hidden">
          <viewer-bookmarks :bookmarks="bookmarks" :update-tab="updateTab" />
        </div>
      </div>
    </div>
  `,
};