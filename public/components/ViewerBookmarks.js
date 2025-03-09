// components/ViewerBookmarks.js
import { useClips } from "../composables/useClips.js";
import { useDocuments } from "../composables/useDocuments.js";
import { useScrollNavigation } from "../composables/useScrollNavigation.js";

export default {
  name: "ViewerBookmarks",
  props: {
    updateTab: {
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
              <span class="text-gray-300">{{ bookmark.data.name }}</span>
              <button
                @click.stop="removeBookmark(bookmark.id)"
                class="text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
            <div class="text-gray-400 text-sm mt-1">
              {{ bookmark.data.type === 'pdf-page' ? 'Page ' + (bookmark.data.pageIndex + 1) : 'Text Selection' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  setup(props) {
    const { bookmarks, removeBookmark } = useClips();
    const { documents, setSelectedDocument } = useDocuments();
    const { jumpToPageNumber } = useScrollNavigation();

    const sortedBookmarks = Vue.computed(() => {
      return [...bookmarks.value].sort((a, b) => b.timestamp - a.timestamp);
    });

    function navigateToBookmark(bookmark) {
      const doc = documents.value.find(
        (d) => d.id === bookmark.data.documentId
      );
      if (doc) {
        setSelectedDocument(doc);
        if (props.updateTab) {
          props.updateTab("Documents", "Viewer", {
            documents: documents.value,
            bookmarks: bookmarks.value,
          });
        }
        Vue.nextTick(() => {
          if (doc.data.type === "pdf" && bookmark.data.type === "pdf-page") {
            const pageIndex = bookmark.data.pageIndex;

            jumpToPageNumber.value = pageIndex + 1;
          } else if (bookmark.data.type === "text") {
            const contentEl = document.querySelector("pre");
            if (contentEl) {
              contentEl.scrollTop =
                (bookmark.data.offset / doc.data.processedContent.length) *
                contentEl.scrollHeight;
            } else {
              console.error("Text content element not found for scrolling");
            }
          }
        });
      } else {
        console.error(
          `Document not found for bookmark: ${bookmark.data.documentId}`
        );
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
