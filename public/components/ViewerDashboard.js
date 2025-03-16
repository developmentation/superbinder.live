// components/ViewerDashboard.js
import { useRealTime } from '../composables/useRealTime.js';
import { useHistory } from '../composables/useHistory.js';
import { useSections } from '../composables/useSections.js';
import { useGoals } from '../composables/useGoals.js';
import { useAgents } from '../composables/useAgents.js';
import { useQuestions } from '../composables/useQuestions.js';
import { useCollaboration } from '../composables/useCollaboration.js';
import { useChat } from '../composables/useChat.js';

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
      <div class="bg-[#1a2233] p-1 border-b border-[#2d3748] flex items-center justify-between glass-effect mb-4 px-3">
        <div class="flex items-center space-x-3">
          <h1 class="text-lg font-semibold text-[#34d399]">
            Channel: {{ channelName }} ({{ participantCount }} participants)
          </h1>
        </div>
        <div class="flex items-center space-x-3">
          <button @click="toggleRoomLock" class="p-2 text-[#e2e8f0] hover:text-[#34d399] transition-colors" title="Toggle Room Lock">
            <i :class="isRoomLocked ? 'pi pi-lock' : 'pi pi-unlock'" class="text-xl"></i>
          </button>
          <button @click="removeChannel" class="p-2 text-[#e2e8f0] hover:text-[#ef4444] transition-colors" title="Remove Channel">
            <i class="pi pi-trash text-xl"></i>
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto custom-scrollbar px-4">
        <div class="grid grid-cols-1 lg:grid-cols-[minmax(300px,1fr)_minmax(0,3fr)] gap-4 h-full">
          <!-- Users in Room -->
          <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg col-span-1 h-full">
            <div class="flex items-center gap-3 mb-3">
              <i class="pi pi-users text-[#3b82f6] text-3xl"></i>
              <h2 class="text-base font-semibold text-[#e2e8f0]">Users in Room</h2>
            </div>
            <p class="text-2xl font-bold text-[#34d399] mb-3">{{ userCount }}</p>
            <ul class="space-y-2 max-h-[calc(100%-100px)] overflow-y-auto custom-scrollbar">
              <li v-for="(user, uuid) in activeUsers" :key="uuid" class="flex items-center gap-2 p-2 hover:bg-[#2d3748] rounded-lg transition-colors cursor-pointer">
                <span :style="{ backgroundColor: user?.color }" class="w-4 h-4 rounded-full inline-block"></span>
                <span class="text-[#e2e8f0] text-sm">{{ user.displayName }}</span>
              </li>
              <li v-if="userCount === 0" class="text-[#94a3b8] text-sm">No users currently in the room.</li>
            </ul>
          </div>

          <!-- Metrics -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
            <!-- Goals Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Goals')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-target text-[#10b981] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Goals</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ goals.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total number of goals set.</p>
            </div>

            <!-- Agents Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Agents')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-user text-[#f97316] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Agents</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ agents.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total active agents.</p>
            </div>

            <!-- Sections Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Sections')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-list text-[#06b6d4] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Sections</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ sections.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total sections created.</p>
            </div>

            <!-- Questions Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Q&A')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-question-circle text-[#8b5cf6] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Questions</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ questions.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total questions asked.</p>
            </div>

            <!-- Answers Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Q&A')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-check-circle text-[#14b8a6] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Answers</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ answers.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total answers provided.</p>
            </div>

            <!-- Breakouts Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Collaboration')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-users text-[#ec4899] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Breakouts</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ breakouts.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total breakout rooms.</p>
            </div>

            <!-- Chat Messages Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Chat')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-comments text-[#6366f1] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Chat Messages</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ messages.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total chat message count.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  setup(props) {
    const { activeUsers, channelName, isRoomLocked, emit, userUuid } = useRealTime();
    const { sections } = useSections();
    const { goals } = useGoals();
    const { agents } = useAgents();
    const { questions, answers } = useQuestions();
    const { breakouts } = useCollaboration();
    const { messages } = useChat();

    const userCount = Vue.computed(() => Object.keys(activeUsers.value).length);
    const participantCount = Vue.computed(() => userCount.value);

    function navigateToTab(tab, subTab = null) {
      props.updateTab(tab, subTab);
    }

    function toggleRoomLock() {
      const newLockState = !isRoomLocked.value;
      isRoomLocked.value = newLockState;
      emit("room-lock-toggle", {
        id: null,
        data: { locked: newLockState, channelName: channelName.value },
      }).catch(error => {
        console.error('Error emitting room-lock-toggle:', error);
        isRoomLocked.value = !newLockState; // Fallback
      });
    }

    function removeChannel() {
      emit("remove-channel", {
        id: channelName.value, // Optional, can be derived from channelName if backend requires it
        channel:channelName.value,
        data: {
          userUuid: userUuid.value,
          channelName: channelName.value,
          timestamp: Date.now(),
        },
      }).catch(error => {
        console.error('Error emitting remove-channel:', error);
      });
    }

    return {
      activeUsers,
      userCount,
      channelName,
      participantCount,
      isRoomLocked,
      toggleRoomLock,
      removeChannel,
      sections,
      goals,
      agents,
      questions,
      answers,
      breakouts,
      messages,
      navigateToTab,
    };
  },
};