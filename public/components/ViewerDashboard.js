// components/ViewerDashboard.js
import { useRealTime } from '../composables/useRealTime.js';
import { useHistory } from '../composables/useHistory.js';

export default {
  name: 'ViewerDashboard',
  props: {
    updateTab: {
      type: Function,
      required: true,
    },
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden p-4 text-white">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-y-auto">
        <!-- Users (Dedicated Column) -->
        <div class="bg-gray-800 p-6 rounded-lg shadow-lg col-span-1">
          <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
            <i class="pi pi-users text-purple-400"></i>
            Users in Room: {{ userCount }}
          </h2>
          <ul class="mt-2 space-y-1 max-h-60 overflow-y-auto">
            <li 
              v-for="(user, uuid) in activeUsers" 
              :key="uuid" 
              class="flex items-center gap-2 p-1 hover:bg-gray-700 rounded transition-colors cursor-pointer"
              @click="navigateToTab('Dashboard')"
            >
              <span :style="{ color: user.color }" class="w-3 h-3 rounded-full inline-block"></span>
              {{ user.displayName }}
            </li>
            <li v-if="userCount === 0" class="text-gray-400">No users currently in the room.</li>
          </ul>
        </div>

        <!-- Other Metrics (3 Columns) -->
        <div class="col-span-1 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Goals -->
          <div 
            class="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all cursor-pointer"
            @click="navigateToTab('Goals')"
          >
            <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
              <i class="pi pi-target text-green-400"></i>
              Goals: {{ history.goals.length }}
            </h2>
            <p class="text-gray-400">Total number of goals set.</p>
          </div>

          <!-- Documents -->
          <div 
            class="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all cursor-pointer"
            @click="navigateToTab('Documents', 'Viewer')"
          >
            <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
              <i class="pi pi-file text-blue-400"></i>
              Documents: {{ history.documents.length }}
            </h2>
            <p class="text-gray-400">Total uploaded documents.</p>
          </div>

          <!-- Clips -->
          <div 
            class="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all cursor-pointer"
            @click="navigateToTab('Documents', 'Clips')"
          >
            <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
              <i class="pi pi-video text-yellow-400"></i>
              Clips: {{ history.clips.length }}
            </h2>
            <p class="text-gray-400">Total video/audio clips.</p>
          </div>

          <!-- Agents -->
          <div 
            class="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all cursor-pointer"
            @click="navigateToTab('Agents')"
          >
            <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
              <i class="pi pi-user text-orange-400"></i>
              Agents: {{ history.agents.length }}
            </h2>
            <p class="text-gray-400">Total active agents.</p>
          </div>

          <!-- Questions -->
          <div 
            class="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all cursor-pointer"
            @click="navigateToTab('Q&A')"
          >
            <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
              <i class="pi pi-question-circle text-purple-400"></i>
              Questions: {{ history.questions.length }}
            </h2>
            <p class="text-gray-400">Total questions asked.</p>
          </div>

          <!-- Answers -->
          <div 
            class="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all cursor-pointer"
            @click="navigateToTab('Q&A')"
          >
            <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
              <i class="pi pi-check-circle text-teal-400"></i>
              Answers: {{ answerCount }}
            </h2>
            <p class="text-gray-400">Total answers provided.</p>
          </div>

          <!-- Chat Messages -->
          <div 
            class="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all cursor-pointer"
            @click="navigateToTab('Chat')"
          >
            <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
              <i class="pi pi-comments text-indigo-400"></i>
              Chat Messages: {{ history.messages.length }}
            </h2>
            <p class="text-gray-400">Total chat message count.</p>
          </div>

          <!-- Artifacts -->
          <div 
            class="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all cursor-pointer"
            @click="navigateToTab('Artifacts')"
          >
            <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
              <i class="pi pi-box text-red-400"></i>
              Artifacts: {{ history.artifacts.length }}
            </h2>
            <p class="text-gray-400">Total artifacts stored.</p>
          </div>

          <!-- Transcripts -->
          <div 
            class="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all cursor-pointer"
            @click="navigateToTab('Transcriptions')"
          >
            <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
              <i class="pi pi-file-word text-pink-400"></i>
              Transcripts: {{ history.transcripts.length }}
            </h2>
            <p class="text-gray-400">Total transcription entries.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  setup(props) {
    const { activeUsers } = useRealTime();
    const { gatherLocalHistory } = useHistory();

    const history = Vue.ref(gatherLocalHistory());
    const userCount = Vue.computed(() => Object.keys(activeUsers.value).length);
    const answerCount = Vue.computed(() => {
      return history.value.questions.reduce((total, question) => {
        return total + (question.answers ? question.answers.length : 0);
      }, 0);
    });

    Vue.watch(
      () => [activeUsers.value, gatherLocalHistory()],
      () => {
        history.value = gatherLocalHistory();
      },
      { deep: true }
    );

    function navigateToTab(tab, subTab = null) {
      // Pass documents with renderAsHtml flag for .docx, .xlsx, and .pdf
      const documents = history.value.documents.map(doc => ({
        ...doc,
        renderAsHtml: ['docx', 'xlsx', 'pdf'].includes(doc.type),
      }));
      props.updateTab(tab, subTab, { documents });
    }

    return {
      activeUsers,
      userCount,
      history,
      answerCount,
      navigateToTab,
    };
  },
};