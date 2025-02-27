// components/Viewer.vue
import ViewerGoals from './ViewerGoals.js';
import ViewerAgents from './ViewerAgents.js';
import ViewerDocuments from './ViewerDocuments.js';
import ViewerClips from './ViewerClips.js';
import ViewerTranscribe from './ViewerTranscribe.js';
import ViewerQuestions from './ViewerQuestions.js';
import ViewerArtifacts from './ViewerArtifacts.js';
import Uploads from './ViewerUploads.js'; // Renamed DocumentSidebar.js
import { useRealTime } from '../composables/useRealTime.js';

export default {
  name: 'Viewer',
  components: {
    ViewerGoals,
    ViewerAgents,
    ViewerDocuments,
    ViewerClips,
    ViewerTranscribe,
    ViewerQuestions,
    ViewerArtifacts,
    Uploads,
  },
  props: {
    activeTab: {
      type: String,
      required: true,
    },
    activeDocumentSubTab: {
      type: String,
      default: 'Uploads', // Default to Uploads for Documents
    },
  },
  setup() {
    const { emit } = useRealTime();

    // Sync tab changes via Socket.io (optional, since Binder.js handles this)
    function updateActiveTab(tab, subTab = null) {
      emit('update-tab', { tab, subTab });
    }

    return {
      updateActiveTab,
    };
  },
  template: `
    <div class="h-full p-4">
      <viewer-goals v-show="activeTab === 'Goals'" />
      <viewer-agents v-show="activeTab === 'Agents'" />
      <viewer-documents v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Viewer'" />
      <viewer-clips v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Clips'" />
      <viewer-transcribe v-show="activeTab === 'Transcriptions'" />
      <viewer-questions v-show="activeTab === 'Q&A'" />
      <viewer-artifacts v-show="activeTab === 'Artifacts'" />
      <uploads v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Uploads'" />
    </div>
  `,
};