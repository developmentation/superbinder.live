// components/Viewer.js
import ViewerGoals from './ViewerGoals.js';
import ViewerAgents from './ViewerAgents.js';
import ViewerDocuments from './ViewerDocuments.js';
import ViewerClips from './ViewerClips.js';
import ViewerBookmarks from './ViewerBookmarks.js';
import ViewerTranscribe from './ViewerTranscribe.js';
import ViewerQuestions from './ViewerQuestions.js';
import ViewerArtifacts from './ViewerArtifacts.js';
import ViewerUploads from './ViewerUploads.js';
import ViewerDashboard from './ViewerDashboard.js';
import { useRealTime } from '../composables/useRealTime.js';

export default {
  name: 'Viewer',
  components: {
    ViewerGoals,
    ViewerAgents,
    ViewerDocuments,
    ViewerBookmarks,
    ViewerClips,
    ViewerTranscribe,
    ViewerQuestions,
    ViewerArtifacts,
    ViewerUploads,
    ViewerDashboard,
  },
  props: {
    activeTab: {
      type: String,
      required: true,
    },
    activeDocumentSubTab: {
      type: String,
      default: 'Uploads',
    },
    updateTab: {
      type: Function,
      required: true,
    },
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
    const { emit } = useRealTime();

    function updateActiveTab(tab, subTab = null, data = {}) {
      emit('update-tab', { tab, subTab, ...data });
    }

    return {
      updateActiveTab,
    };
  },
  template: `
    <div class="h-auto p-4">
      <viewer-dashboard v-show="activeTab === 'Dashboard'" :update-tab="updateTab" />
      <viewer-goals v-show="activeTab === 'Goals'" />
      <viewer-agents v-show="activeTab === 'Agents'" />
      <viewer-documents 
        v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Viewer'" 
        :documents="documents" 
        :bookmarks="bookmarks"
      />
      <viewer-clips 
        v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Clips'" 
        :update-tab="updateTab"  
      />
      <viewer-bookmarks 
        v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Bookmarks'" 
        :update-tab="updateTab"
      />
      <viewer-transcribe v-show="activeTab === 'Transcriptions'" />
      <viewer-questions v-show="activeTab === 'Q&A'" :bookmarks="bookmarks" />
      <viewer-artifacts v-show="activeTab === 'Artifacts'" />
      <viewer-uploads 
        v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Uploads'" 
        :update-tab="updateTab"
      />
    </div>
  `,
};