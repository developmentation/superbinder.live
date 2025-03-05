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
      <div v-for="clip in clips" :key="clip.id" class="p-4 bg-gray-700 rounded-lg cursor-pointer" @click="navigateToClip(clip)">
        <p>{{ clip.content.substring(0, 50) }}...</p>
        <div class="flex gap-2 mt-2" @click.stop>
          <button @click="addQuestionFromClip(clip.content, clip.documentId)" class="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Add as Question</button>
          <button @click="voteClip(clip.id, 'up')" class="text-green-400">↑ {{ clip.votes }}</button>
          <button @click="voteClip(clip.id, 'down')" class="text-red-400">↓</button>
        </div>
      </div>
      <div v-if="clips.length === 0" class="text-gray-400">No clips yet.</div>
    </div>
  `,
  setup(props) {
    const { clips, voteClip } = useClips();
    const { addQuestionProgrammatically } = useQuestions();
    const { documents, setSelectedDocument } = useDocuments();

    function addQuestionFromClip(content, documentId) {
      addQuestionProgrammatically(content);
    }

    function navigateToClip(clip) {
      console.log('navigateToClip called:', clip);
      const doc = documents.value.find(d => d.id === clip.documentId);
      if (doc) {
        console.log('Document found:', doc);
        setSelectedDocument(doc);
        if (props.updateTab) {
          console.log('Calling updateTab:', { tab: 'Documents', subTab: 'Viewer', documents: documents.value });
          props.updateTab('Documents', 'Viewer', { documents: documents.value });
        } else {
          console.warn('updateTab not provided');
        }
        const scrollToLocation = (attempt = 0) => {
          const contentEl = document.querySelector('.pdf-viewer') || document.querySelector('pre');
          console.log('contentEl:', contentEl);
          const scrollContainer = document.querySelector('.flex-1.overflow-y-auto'); // Target the scrollable parent
          console.log('scrollContainer:', scrollContainer);
          if (scrollContainer && clip.location) {
            console.log('Clip location:', clip.location);
            if (clip.location.pageIndex !== undefined) {
              const pageEl = contentEl.querySelectorAll('.pdf-page')[clip.location.pageIndex];
              console.log('Page element:', pageEl);
              if (pageEl) {
                pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                console.log('Scrolled to page:', clip.location.pageIndex);
              } else {
                console.warn(`Page ${clip.location.pageIndex} not found in document ${doc.id}`);
              }
            } else if (clip.location.offset !== undefined) {
              const textIndex = doc.processedContent.indexOf(clip.content);
              if (textIndex >= 0) {
                const scrollHeight = scrollContainer.scrollHeight;
                const contentLength = doc.processedContent.length;
                const scrollPosition = (textIndex / contentLength) * scrollHeight;
                console.log('Scroll details:', { textIndex, contentLength, scrollHeight, scrollPosition });
                scrollContainer.scrollTop = scrollPosition;
                console.log('Scrolled to offset:', scrollPosition);
              } else {
                console.warn('Clip content not found in document:', clip.content);
              }
            }
          } else if (!scrollContainer && attempt < 5) {
            console.log('Scroll container not found, retrying...', attempt);
            setTimeout(() => scrollToLocation(attempt + 1), 400); // Increased delay to 400ms
          } else {
            console.warn('Failed to scroll:', { scrollContainer, location: clip.location });
          }
        };
        Vue.nextTick(() => scrollToLocation());
      } else {
        console.warn(`Document with ID ${clip.documentId} not found`);
      }
    }

    return { clips, voteClip, addQuestionFromClip, navigateToClip };
  },
};