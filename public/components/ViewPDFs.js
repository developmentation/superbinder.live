// components/ViewPDFs.js
import LazyScrollViewer from './LazyScrollViewer.js';
import { useClips } from '../composables/useClips.js';

export default {
  name: 'ViewPDFs',
  components: { LazyScrollViewer },
  props: {
    document: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const { addBookmark } = useClips();
    const lazyScrollViewer = Vue.ref(null);
    const jumpToPageInput = Vue.ref('');
    const selectedPageIndex = Vue.ref(null);
    const showContextMenu = Vue.ref(false);
    const contextMenuX = Vue.ref(0);
    const contextMenuY = Vue.ref(0);
    const contextMenuOptions = Vue.ref([]);
    const pageItems = Vue.ref(props.document.data.pages || []);
    const headerHeight = Vue.ref(0); // Track header height

    // Watch for changes to props.document and update pageItems
    Vue.watch(
      () => props.document,
      (newDocument) => {
        console.log('Document changed, updating pageItems:', newDocument);
        pageItems.value = newDocument.data.pages || [];
        // Reset selected page index when document changes
        selectedPageIndex.value = null;
        jumpToPageInput.value = '';
        // Optionally reset LazyScrollViewer scroll position
        if (lazyScrollViewer.value) {
          Vue.nextTick(() => {
            lazyScrollViewer.value.scrollToPage(0);
          });
        }
      },
      { deep: true } // Watch for deep changes in the document object
    );

    // Measure header height on mount
    Vue.onMounted(() => {
      const header = document.querySelector('.sticky.top-0');
      headerHeight.value = header?.offsetHeight || 0;
      document.addEventListener('click', hideContextMenu);
    });

    Vue.onUnmounted(() => {
      document.removeEventListener('click', hideContextMenu);
    });

    const jumpToPage = () => {
      const pageNum = parseInt(jumpToPageInput.value, 10);
      if (isNaN(pageNum)) {
        console.error('Invalid page number entered:', jumpToPageInput.value);
        jumpToPageInput.value = '';
        return;
      }
      const pageIndex = pageNum - 1;
      const maxPages = pageItems.value.length || 0;
      if (pageIndex >= 0 && pageIndex < maxPages) {
        console.log(`Jumping to page index: ${pageIndex} (1-based: ${pageNum})`);
        scrollToPage(pageIndex);
        jumpToPageInput.value = '';
      } else {
        console.error(`Invalid page number: ${pageNum}. Must be between 1 and ${maxPages}`);
        jumpToPageInput.value = '';
      }
    };

    const scrollToPage = (pageIndex) => {
      if (lazyScrollViewer.value && pageItems.value.length > pageIndex) {
        console.log(`Calling scrollToPage for index: ${pageIndex}`);
        lazyScrollViewer.value.scrollToPage(pageIndex);
        selectedPageIndex.value = pageIndex;
      } else {
        console.error(`Scroll failed: pageIndex=${pageIndex}, pages=${pageItems.value.length}`);
      }
    };

    const handleContextMenu = (event, pageIndex) => {
      event.preventDefault();
      selectedPageIndex.value = pageIndex;
      contextMenuOptions.value = ['Create Bookmark'];
      const scrollViewer = lazyScrollViewer.value.scrollContainer;
      const scrollTop = scrollViewer.scrollTop;
      const scrollLeft = scrollViewer.scrollLeft;
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

    const addBookmarkFromContext = () => {
      if (props.document && selectedPageIndex.value !== null) {
        const pageNumber = selectedPageIndex.value + 1;
        addBookmark({
          documentId: props.document.id,
          pageIndex: selectedPageIndex.value,
          type: 'pdf-page',
          name: `${props.document.data.name} - Page ${pageNumber}`,
        });
      }
      hideContextMenu();
    };

    const hideContextMenu = () => {
      showContextMenu.value = false;
    };

    return {
      lazyScrollViewer,
      jumpToPageInput,
      selectedPageIndex,
      showContextMenu,
      contextMenuX,
      contextMenuY,
      contextMenuOptions,
      pageItems,
      headerHeight,
      jumpToPage,
      handleContextMenu,
      addBookmarkFromContext,
      hideContextMenu,
    };
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <div class="p-2 bg-[#1a2233] border-b border-[#2d3748] sticky top-0 z-20 flex items-center gap-2">
        <span class="text-[#94a3b8] text-sm">Page:</span>
        <input
          type="text"
          inputmode="numeric"
          v-model="jumpToPageInput"
          @keyup.enter="jumpToPage"
          class="w-16 p-1 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] focus:border-[#4dabf7] focus:outline-none appearance-none text-sm"
          :placeholder="'1-' + pageItems.length"
        />
        <span class="text-[#94a3b8] text-sm">of {{ pageItems.length }}</span>
        <button
          @click="jumpToPage"
          class="py-1 px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm"
        >
          Go
        </button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <lazy-scroll-viewer
          ref="lazyScrollViewer"
          :pages="pageItems"
          :buffer="1"
          :header-offset="headerHeight"
          class="pdf-viewer"
          @contextmenu="handleContextMenu"
          :key="document.id"
        />
      </div>
      <div
        v-if="showContextMenu"
        :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
        class="fixed bg-[#1a2233] border border-[#2d3748] rounded-lg shadow-lg z-20"
        @click.stop
      >
        <div
          v-for="option in contextMenuOptions"
          :key="option"
          class="px-4 py-2 text-[#e2e8f0] hover:bg-[#2d3748] cursor-pointer text-sm"
          @click="option === 'Create Bookmark' ? addBookmarkFromContext() : null"
        >
          {{ option }}
        </div>
      </div>
    </div>
  `,
};