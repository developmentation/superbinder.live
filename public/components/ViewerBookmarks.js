import { useClips } from '../composables/useClips.js';
import { useDocuments } from '../composables/useDocuments.js';

export default {
  name: 'ViewerBookmarks',
  props: {
    updateTab: { // Add prop to receive updateTab from Viewer.vue
      type: Function,
      default: null,
    },
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <div class="p-2 bg-gray-800 border-b border-gray-700">
        <h2 class="text-lg font-semibold text-white">Bookmarks</h2>
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="bookmarks.length === 0" class="text-gray-400">
          No bookmarks available.
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="bookmark in sortedBookmarks"
            :key="bookmark.id"
            class="bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
            @click="navigateToBookmark(bookmark)"
          >
            <div class="flex justify-between items-center">
              <span class="text-gray-300">{{ bookmark.name }}</span>
              <button
                @click.stop="removeBookmark(bookmark.id)"
                class="text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
            <div class="text-gray-400 text-sm mt-1">
              {{ bookmark.type === 'pdf-page' ? 'Page ' + (bookmark.pageIndex + 1) : 'Text Selection' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  setup(props) {
    const { bookmarks, removeBookmark } = useClips();
    const { documents, setSelectedDocument } = useDocuments();

    const sortedBookmarks = Vue.computed(() => {
      return [...bookmarks.value].sort((a, b) => b.timestamp - a.timestamp); // Newest first
    });

    function navigateToBookmark(bookmark) {
      const doc = documents.value.find(d => d.id === bookmark.documentId);
      if (doc) {
        // Set the selected document
        setSelectedDocument(doc);

        // Navigate to the Documents tab with Viewer sub-tab
        if (props.updateTab) {
          props.updateTab('Documents', 'Viewer', { documents: documents.value, bookmarks: bookmarks.value });
        }

        // Scroll to the bookmark location after rendering
        Vue.nextTick(() => {
          const contentEl = document.querySelector('.pdf-viewer') || document.querySelector('pre');
          if (contentEl) {
            if (bookmark.type === 'pdf-page') {
              const pageEl = contentEl.querySelectorAll('.pdf-page')[bookmark.pageIndex];
              if (pageEl) {
                pageEl.scrollIntoView({ behavior: 'smooth' });
              } else {
                console.warn(`Page ${bookmark.pageIndex} not found in document ${doc.id}`);
              }
            } else if (bookmark.type === 'text') {
              contentEl.scrollTop = bookmark.offset / doc.processedContent.length * contentEl.scrollHeight;
            }
          } else {
            console.warn('Document content element not found');
          }
        });
      } else {
        console.warn(`Document with ID ${bookmark.documentId} not found`);
      }
    }

    return {
      bookmarks,
      sortedBookmarks,
      removeBookmark,
      navigateToBookmark,
    };
  },
};