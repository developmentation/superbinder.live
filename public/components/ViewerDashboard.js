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
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Header with Channel Info -->
      <div class="bg-[#1a2233] p-4 border-b border-[#2d3748] flex items-center justify-between glass-effect mb-4">
        <div class="flex items-center space-x-3">
          <h1 class="text-lg font-semibold text-[#34d399]">
            Channel: {{ channelName }} ({{ participantCount }} participants)
          </h1>
        </div>
        <div class="flex items-center space-x-3">
          <button @click="toggleRoomLock" class="p-2 text-[#e2e8f0] hover:text-[#34d399] transition-colors" title="Toggle Room Lock">
            <i :class="isRoomLocked ? 'pi pi-lock' : 'pi pi-unlock'" class="text-xl"></i>
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto custom-scrollbar px-4">
        <div class="grid grid-cols-1 lg:grid-cols-[minmax(300px,1fr)_minmax(0,3fr)] gap-4 h-full">
          <!-- Users in Room (Dedicated Column) -->
          <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg col-span-1 h-full">
            <div class="flex items-center gap-3 mb-3">
              <i class="pi pi-users text-[#3b82f6] text-3xl"></i>
              <h2 class="text-base font-semibold text-[#e2e8f0]">Users in Room</h2>
            </div>
            <p class="text-2xl font-bold text-[#34d399] mb-3">{{ userCount }}</p>
            <ul class="space-y-2 max-h-[calc(100%-100px)] overflow-y-auto custom-scrollbar">
              <li
                v-for="(user, uuid) in activeUsers"
                :key="uuid"
                class="flex items-center gap-2 p-2 hover:bg-[#2d3748] rounded-lg transition-colors cursor-pointer"
                @click="navigateToTab('Dashboard')"
              >
                <span :style="{ backgroundColor: user?.color }" class="w-4 h-4 rounded-full inline-block"></span>
                <span class="text-[#e2e8f0] text-sm">{{ user.displayName }}</span>
              </li>
              <li v-if="userCount === 0" class="text-[#94a3b8] text-sm">No users currently in the room.</li>
            </ul>
          </div>

          <!-- Other Metrics (Right Section) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
            <!-- Goals Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Goals')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-target text-[#10b981] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Goals</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ (history.goals || []).length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total number of goals set.</p>
            </div>

            <!-- Documents Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Documents', 'Viewer')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-file text-[#3b82f6] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Documents</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ (history.documents || []).length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total uploaded documents.</p>
            </div>

            <!-- Clips Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Documents', 'Clips')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-video text-[#f59e0b] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Clips</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ (history.clips || []).length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total video/audio clips.</p>
            </div>

            <!-- Bookmarks Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Documents', 'Bookmarks')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-bookmark text-[#06b6d4] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Bookmarks</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ (history.bookmarks || []).length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total bookmarks created.</p>
            </div>

            <!-- Agents Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Agents')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-user text-[#f97316] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Agents</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ (history.agents || []).length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total active agents.</p>
            </div>

            <!-- Questions Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Q&A')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-question-circle text-[#8b5cf6] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Questions</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ (history.questions || []).length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total questions asked.</p>
            </div>

            <!-- Answers Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Q&A')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-check-circle text-[#14b8a6] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Answers</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ answerCount }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total answers provided.</p>
            </div>

            <!-- Chat Messages Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Chat')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-comments text-[#6366f1] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Chat Messages</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ (history.messages || []).length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total chat message count.</p>
            </div>

            <!-- Artifacts Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Artifacts')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-box text-[#ef4444] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Artifacts</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ (history.artifacts || []).length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total artifacts stored.</p>
            </div>

            <!-- Transcripts Card -->
            <div
              class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
              @click="navigateToTab('Transcriptions')"
            >
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-file-word text-[#ec4899] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Transcripts</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ (history.transcripts || []).length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total transcription entries.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  setup(props) {
    const { activeUsers, channelName, isRoomLocked, emit } = useRealTime();
    const { gatherLocalHistory } = useHistory();

    const history = Vue.ref(gatherLocalHistory());
    const userCount = Vue.computed(() => Object.keys(activeUsers.value).length);
    const participantCount = Vue.computed(() => userCount.value);
    const answerCount = Vue.computed(() => (history.value.answers || []).length);

    Vue.watch(
      () => [activeUsers.value, gatherLocalHistory()],
      () => {
        history.value = gatherLocalHistory();
      },
      { deep: true }
    );

    function navigateToTab(tab, subTab = null) {
      const documents = (history.value.documents || []).map(doc => ({
        ...doc,
        renderAsHtml: ['docx', 'xlsx', 'pdf'].includes(doc.type),
      }));
      const bookmarks = history.value.bookmarks || [];
      props.updateTab(tab, subTab, { documents, bookmarks });
    }

    function toggleRoomLock() {
      const newLockState = !isRoomLocked.value;
      isRoomLocked.value = newLockState;
      emit("room-lock-toggle", {
        id: null, // Add id to match expected structure
        data: { locked: newLockState, channelName: channelName.value, }, // Nest locked in data
        
      }).catch(error => {
        console.error('Error emitting room-lock-toggle:', error);
        isRoomLocked.value = !newLockState; // Fallback
      });
    }

    return {
      activeUsers,
      userCount,
      history,
      answerCount,
      navigateToTab,
      channelName,
      participantCount,
      isRoomLocked,
      toggleRoomLock,
    };
  },
};