// components/ViewerDashboard.js
import { useRealTime } from '../composables/useRealTime.js';
import { useHistory } from '../composables/useHistory.js';
import { useSections } from '../composables/useSections.js';
import { useGoals } from '../composables/useGoals.js';
import { useAgents } from '../composables/useAgents.js';
import { useQuestions } from '../composables/useQuestions.js';
import { useCollaboration } from '../composables/useCollaboration.js';
import { useChat } from '../composables/useChat.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useArtifacts } from '../composables/useArtifacts.js';
import { usePrompts } from '../composables/usePrompts.js';
import { useTranscriptions } from '../composables/useTranscriptions.js';
import { useLiveTranscriptions } from '../composables/useLiveTranscriptions.js';
import { useLibrary } from '../composables/useLibrary.js';

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
            Binder: {{ channelName }} ({{ participantCount }} participants)
          </h1>
        </div>
        <div class="flex items-center space-x-3">
          <button @click="openPublishModal" class="p-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm" title="Publish Binder as Template">
            Publish to Library
          </button>
          <button @click="toggleRoomLock" class="p-2 text-[#e2e8f0] hover:text-[#34d399] transition-colors" title="Toggle Room Lock">
            <i :class="isRoomLocked ? 'pi pi-lock' : 'pi pi-unlock'" class="text-xl"></i>
          </button>
          <button @click="removeChannel" class="p-2 text-[#e2e8f0] hover:text-[#ef4444] transition-colors" title="Remove Binder">
            <i class="pi pi-trash text-xl"></i>
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto custom-scrollbar px-4">
        <div class="grid grid-cols-1 lg:grid-cols-[minmax(300px,1fr)_minmax(0,3fr)] gap-4 h-[calc(100%-100px)]">
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
            <!-- Sections Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Sections')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-list text-[#06b6d4] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Sections</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ sections.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total sections created.</p>
            </div>

            <!-- Documents Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Sections')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-file text-[#10b981] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Documents</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ documents.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total documents uploaded.</p>
            </div>

            <!-- Artifacts Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Sections')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-box text-[#f97316] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Artifacts</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ artifacts.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total artifacts created.</p>
            </div>

            <!-- Goals Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Goals')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-target text-[#10b981] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Goals</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ goals.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total number of goals set.</p>
            </div>

            <!-- Prompts Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Goals')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-target text-[#10b981] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Prompts</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ prompts.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total number of prompts created.</p>
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

            <!-- Breakouts Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Collaboration')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-users text-[#ec4899] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Breakouts</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ breakouts.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total breakout rooms.</p>
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

            <!-- Transcriptions Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Q&A')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-check-circle text-[#14b8a6] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Transcriptions</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ transcriptions.length }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total files transcribed.</p>
            </div>

              <!-- Live Transcriptions Card -->
            <div class="bg-[#1a2233] p-4 rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer" @click="navigateToTab('Q&A')">
              <div class="flex items-center gap-3 mb-2">
                <i class="pi pi-check-circle text-[#14b8a6] text-3xl"></i>
                <h2 class="text-base font-semibold text-[#e2e8f0]">Live Interactions</h2>
              </div>
              <p class="text-2xl font-bold text-[#34d399]">{{ liveTranscriptions.length || 0 }}</p>
              <p class="text-[#94a3b8] text-sm mt-1">Total live interactions.</p>
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

      <!-- Publish Modal -->
      <div v-if="isPublishModalOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
          <h2 class="text-lg font-semibold text-purple-400 mb-4">Publish Binder to Library</h2>
          <div class="space-y-4">
            <input
              v-model="publishName"
              type="text"
              class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              placeholder="Binder Name"
            />
            <textarea
              v-model="publishDescription"
              class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none h-24"
              placeholder="Description..."
            ></textarea>
            <p v-if="libraryError" class="text-red-500 text-sm">{{ libraryError }}</p>
          </div>
          <div class="mt-4 flex gap-2 justify-end">
            <button @click="closePublishModal" class="py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancel</button>
            <button @click="publish" :disabled="libraryLoading" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
              {{ libraryLoading ? 'Publishing...' : 'Publish' }}
            </button>
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
    const { documents } = useDocuments();
    const { artifacts } = useArtifacts();
    const { prompts } = usePrompts();
    const { transcriptions } = useTranscriptions();
    const { liveTranscriptions } = useLiveTranscriptions();
    const { libraryArtifacts, loading: libraryLoading, error: libraryError, publishBinder } = useLibrary();

    const userCount = Vue.computed(() => Object.keys(activeUsers.value).length);
    const participantCount = Vue.computed(() => userCount.value);

    const isPublishModalOpen = Vue.ref(false);
    const publishName = Vue.ref('');
    const publishDescription = Vue.ref('');

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
        id: channelName.value,
        channel: channelName.value,
        data: {
          userUuid: userUuid.value,
          channelName: channelName.value,
          timestamp: Date.now(),
        },
      }).catch(error => {
        console.error('Error emitting remove-channel:', error);
      });
    }

    function openPublishModal() {
      isPublishModalOpen.value = true;
      publishName.value = '';
      publishDescription.value = '';
    }

    function closePublishModal() {
      isPublishModalOpen.value = false;
    }

    async function publish() {
      if (!publishName.value || !publishDescription.value) {
        libraryError.value = 'Name and description are required';
        return;
      }
      try {
        await publishBinder(channelName.value, publishName.value, publishDescription.value);
        closePublishModal();
      } catch (err) {
        // Error is handled by useLibrary and stored in libraryError
      }
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
      documents,
      artifacts,
      prompts,
      goals,
      agents,
      questions,
      answers,
      breakouts,
      messages,
      transcriptions,
      liveTranscriptions,
      navigateToTab,
      isPublishModalOpen,
      publishName,
      publishDescription,
      libraryLoading,
      libraryError,
      openPublishModal,
      closePublishModal,
      publish,
    };
  },
};