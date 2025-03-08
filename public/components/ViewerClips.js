// components/ViewerClips.js
import { useClips } from '../composables/useClips.js';
import { useQuestions } from '../composables/useQuestions.js';
import { useDocuments } from '../composables/useDocuments.js';

export default {
  name: 'ViewerClips',
  props: {
    updateTab: {
      type: Function,
      default: null,
    },
  },
  template: `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
      <div v-for="clip in clips" :key="clip.id" class="p-4 bg-gray-700 rounded-lg cursor-pointer relative" @click="navigateToClip(clip)">
        <p>{{ clip.data.content.substring(0, 50) }}...</p>
        <div class="flex gap-2 mt-2" @click.stop>
          <button @click="addQuestionFromClip(clip.data.content, clip.data.documentId)" class="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Add as Question</button>
          <button @click="voteClip(clip.id, 'up')" class="text-green-400">↑ {{ clip.data.votes }}</button>
          <button @click="voteClip(clip.id, 'down')" class="text-red-400">↓</button>
        </div>
        <button @click.stop="removeClip(clip.id)" class="absolute top-2 right-2 text-red-400 hover:text-red-300">
          <i class="pi pi-times"></i>
        </button>
      </div>
      <div v-if="clips.length === 0" class="text-gray-400">No clips yet.</div>
    </div>
  `,
  setup(props) {
    const { clips, voteClip, removeClip } = useClips();
    const { addQuestionProgrammatically } = useQuestions();
    const { documents, setSelectedDocument } = useDocuments();

    function addQuestionFromClip(content, documentId) {
      addQuestionProgrammatically(content);
    }

    function navigateToClip(clip) {
      const doc = documents.value.find(d => d.id === clip.data.documentId);
      if (doc) {
        setSelectedDocument(doc);
        if (props.updateTab) {
          props.updateTab('Documents', 'Viewer', { documents: documents.value });
        }
        const scrollToLocation = (attempt = 0) => {
          const contentEl = document.querySelector('.pdf-viewer') || document.querySelector('pre');
          const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
          if (scrollContainer && clip.data.location) {
            if (clip.data.location.pageIndex !== undefined) {
              const pageEl = contentEl?.querySelectorAll('.pdf-page')[clip.data.location.pageIndex];
              if (pageEl) {
                pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            } else if (clip.data.location.offset !== undefined) {
              const textIndex = doc.data.processedContent.indexOf(clip.data.content);
              if (textIndex >= 0) {
                const scrollHeight = scrollContainer.scrollHeight;
                const contentLength = doc.data.processedContent.length;
                const scrollPosition = (textIndex / contentLength) * scrollHeight;
                scrollContainer.scrollTop = scrollPosition;
              }
            }
          } else if (!scrollContainer && attempt < 5) {
            setTimeout(() => scrollToLocation(attempt + 1), 400);
          }
        };
        Vue.nextTick(() => scrollToLocation());
      }
    }

    return { clips, voteClip, removeClip, addQuestionFromClip, navigateToClip };
  },
};