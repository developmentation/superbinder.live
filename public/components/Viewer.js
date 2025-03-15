// ./components/Viewer.js
import LLMInteraction from './LLMInteraction.js';
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
import ViewerCollaboration from './ViewerCollaboration.js';
import ViewerSections from './ViewerSections.js';
import { useRealTime } from '../composables/useRealTime.js';

export default {
  name: 'Viewer',
  components: {
    LLMInteraction,
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
    ViewerCollaboration,
    ViewerSections,
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
    <div class="h-full w-full  overflow-y-auto custom-scrollbar">
      <!-- Dashboard -->
      <viewer-dashboard
        v-show="activeTab === 'Dashboard'"
        :update-tab="updateTab"
        class="h-full"
      />

      <!-- Goals -->
      <viewer-goals
        v-show="activeTab === 'Goals'"
        class="h-full"
      />

      <!-- Agents -->
      <viewer-agents
        v-show="activeTab === 'Agents'"
        class="h-full"
      />

      <!-- Documents Sub-Tabs -->
      <viewer-documents
        v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Viewer'"
        :documents="documents"
        :bookmarks="bookmarks"
        class="h-full"
      />
      <viewer-clips
        v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Clips'"
        :update-tab="updateTab"
        class="h-full"
      />
      <viewer-bookmarks
        v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Bookmarks'"
        :update-tab="updateTab"
        class="h-full"
      />
      <viewer-uploads
        v-show="activeTab === 'Documents' && activeDocumentSubTab === 'Uploads'"
        :update-tab="updateTab"
        class="h-full"
      />

      <!-- Transcriptions -->
      <viewer-transcribe
        v-show="activeTab === 'Transcriptions'"
        class="h-full"
      />

      <!-- Q&A -->
      <viewer-questions
        v-show="activeTab === 'Q&A'"
        :bookmarks="bookmarks"
        class="h-full"
      />

      <!-- Collaboration -->
      <viewer-collaboration
        v-show="activeTab === 'Collaboration'"
        class="h-full"
      />

      <!-- Artifacts -->
      <viewer-artifacts
        v-show="activeTab === 'Artifacts'"
        class="h-full"
      />

      <!-- Sections -->
      <viewer-sections
        v-show="activeTab === 'Sections'"
        class="h-full"
      />
    </div>
  `,
};