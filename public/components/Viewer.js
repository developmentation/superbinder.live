// ./components/Viewer.js
import LLMInteraction from './LLMInteraction.js';
import ViewerDashboard from './ViewerDashboard.js';
import ViewerSections from './ViewerSections.js';
import ViewerGoals from './ViewerGoals.js';
import ViewerAgents from './ViewerAgents.js';
import ViewerQuestions from './ViewerQuestions.js';
import ViewerCollaboration from './ViewerCollaboration.js';
import ViewerPrompts from './ViewerPrompts.js';
import ViewerTranscriptions from './ViewerTranscriptions.js';
import { useRealTime } from '../composables/useRealTime.js';

export default {
  name: 'Viewer',
  components: {
    LLMInteraction,
    ViewerDashboard,
    ViewerSections,
    ViewerGoals,
    ViewerAgents,
    ViewerQuestions,
    ViewerCollaboration,
    ViewerPrompts,
    ViewerTranscriptions,
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

      <!-- Prompts -->
      <viewer-prompts
        v-show="activeTab === 'Prompts'"
        class="h-full"
      />


      <!-- Agents -->
      <viewer-agents
        v-show="activeTab === 'Agents'"
        class="h-full"
      />

      <!-- Q&A -->
      <viewer-questions
        v-show="activeTab === 'Q&A'"
        :bookmarks="bookmarks"
        class="h-full"
      />

      <!-- Collaboration -->
      <viewer-transcriptions
        v-show="activeTab === 'Transcriptions'"
        class="h-full"
      />

      <!-- Collaboration -->
      <viewer-collaboration
        v-show="activeTab === 'Collaboration'"
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