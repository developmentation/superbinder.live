// components/Binder.js
import { useRealTime } from "../composables/useRealTime.js";
import { useHistory } from "../composables/useHistory.js";
import SessionSetup from "./SessionSetup.js";
import Viewer from "./Viewer.js";
import ChatPanel from "./ChatPanel.js";
import ViewerDashboard from "./ViewerDashboard.js";
import SessionRemoved from "./SessionRemoved.js"; // Import the new component
import { useAgents } from "../composables/useAgents.js";
import { useChat } from "../composables/useChat.js";
import { useDocuments } from "../composables/useDocuments.js";
import { useGoals } from "../composables/useGoals.js";
import { useQuestions } from "../composables/useQuestions.js";
import { useArtifacts } from "../composables/useArtifacts.js";
import { useSections } from "../composables/useSections.js";
import { useCollaboration } from "../composables/useCollaboration.js";
import { usePrompts } from "../composables/usePrompts.js";
import { useConfigs } from "../composables/useConfigs.js";

export default {
  name: "Binder",
  components: {
    SessionSetup,
    Viewer,
    ChatPanel,
    ViewerDashboard,
    SessionRemoved, // Register the new component
  },
  template: `
    <div class="flex flex-col h-screen text-[#e2e8f0] overflow-hidden">
      <!-- Session Setup Screen -->
      <session-setup v-if="!sessionReady" @setup-complete="handleSetupComplete" class="flex-1 flex items-center justify-center bg-[#0a0f1e]" />

      <!-- Main Interface -->
      <div v-if="sessionReady && !isSessionRemoved" class="flex flex-col h-full">
        <!-- Tab Bar -->
        <div class="bg-[#0a0f1e] border-b border-[#2d3748] px-4 py-1 flex items-center justify-between">
          <div class="flex overflow-x-auto scrollbar-hide space-x-2">
            <button
              v-for="tab in tabs"
              :key="tab"
              @click="activeTab = tab; updateActiveTab(tab)"
              class="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap"
              :class="activeTab === tab ? 'bg-[#3b82f6] text-white shadow-lg' : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#2d3748] hover:text-[#e2e8f0]'"
            >
              {{ getTabLabel(tab) }}
            </button>
          </div>
          <!-- Chat Toggle for Desktop -->
          <button
            @click="toggleChat"
            class="px-4 py-2 bg-[#1e293b] text-[#e2e8f0] rounded-lg font-medium hover:bg-[#2d3748] hover:text-[#34d399] transition-all hidden sm:flex items-center gap-2"
            :class="{ 'bg-[#3b82f6] text-white': isChatOpen }"
          >
            <i class="pi pi-comments text-lg"></i>
            <span>Chat ({{chatCount || 0}})</span>
          </button>
        </div>

        <!-- Main Content Area -->
        <div class="flex-1 flex overflow-hidden relative">
          <!-- Document Sub-Tabs (for Documents tab) -->
          <div v-if="activeTab === 'Documents'" class="bg-[#0a0f1e] border-b border-[#2d3748] px-4 py-1 absolute top-0 left-0 right-0 z-10">
            <div class="flex overflow-x-auto scrollbar-hide space-x-2">
              <button
                v-for="subTab in documentSubTabs"
                :key="subTab"
                @click="activeDocumentSubTab = subTab; updateActiveTab('Documents')"
                class="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap"
                :class="activeDocumentSubTab === subTab ? 'bg-[#3b82f6] text-white shadow-lg' : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#2d3748] hover:text-[#e2e8f0]'"
              >
                {{ subTab }}
              </button>
            </div>
          </div>

          <!-- Main Viewer Content -->
          <div
            class="flex-1 overflow-y-auto custom-scrollbar"
            :style="{ paddingTop: activeTab === 'Documents' ? '64px' : '0px' }"
          >
            <viewer
              :active-tab="activeTab"
              :active-document-sub-tab="activeDocumentSubTab"
              :update-tab="updateActiveTab"
              class="w-full h-full"
            />
          </div>

          <!-- Chat Panel (Desktop Sidebar) -->
          <chat-panel
            v-show="isChatOpen && !isMobile"
            :is-open="isChatOpen"
            :is-mobile="isMobile"
            :width="chatWidth"
            @close="toggleChat"
            @update:width="updateChatWidth"
            class="absolute top-0 right-0 h-full border-l border-[#2d3748] glass-effect shadow-2xl"
            :style="{ width: \`\${chatWidth}px\`, zIndex: 100 }"
          />

          <!-- Chat Panel (Mobile Fullscreen) -->
          <chat-panel
            v-show="isChatOpen && isMobile"
            :is-open="isChatOpen"
            :is-mobile="isMobile"
            :width="chatWidth"
            @close="toggleChat"
            @update:width="updateChatWidth"
            class="fixed inset-0 z-50 bg-[#0a0f1e]"
          />
        </div>

        <!-- Chat Button (Mobile Only) -->
        <button
          v-if="isMobile"
          @click="toggleChat"
          class="fixed bottom-6 right-6 p-4 bg-[#3b82f6] text-white rounded-full shadow-lg z-50 transition-transform transform hover:scale-110"
          :class="{ 'bg-[#1e293b]': isChatOpen }"
        >
          <i class="pi pi-comments text-xl"></i>
        </button>
      </div>

      <!-- Session Removed Modal -->
      <session-removed
        v-if="isSessionRemoved"
        :removed-by="sessionRemovedBy"
        @reset-session="handleResetSession"
      />
    </div>
  `,
  setup() {
    const { env } = useConfigs();
    const {
      sessionInfo,
      connect,
      loadSession,
      disconnect,
      isConnected,
      connectionStatus,
      activeUsers,
      emit,
      on,
      off,
      connectionError,
      userUuid,
      displayName,
      channelName,
    } = useRealTime();
    const { gatherLocalHistory } = useHistory();
    const { agents, cleanup: cleanupAgents } = useAgents();
    const { messages, cleanup: cleanupChat } = useChat();
    const { documents, cleanup: cleanupDocuments } = useDocuments();
    const { goals, cleanup: cleanupGoals } = useGoals();
    const { questions, answers, cleanup: cleanupQuestions } = useQuestions();
    const { artifacts, cleanup: cleanupArtifacts } = useArtifacts();
    const { sections, cleanup: cleanupSections } = useSections();
    const { breakouts, cleanup: cleanupCollaboration } = useCollaboration();
    const { prompts, cleanup: cleanupPrompts } = usePrompts();

    const sessionReady = Vue.ref(false);
    const activeTab = Vue.ref("Dashboard");
    const activeDocumentSubTab = Vue.ref("Uploads");
    const tabs = ["Dashboard", "Sections", "Goals", "Prompts", "Agents", "Q&A", "Collaboration", "Transcription"];
    const documentSubTabs = ["Uploads", "Viewer", "Bookmarks"];
    const isRoomLocked = Vue.ref(false);
    const isChatOpen = Vue.ref(false);
    const chatWidth = Vue.ref(350);
    const isMobile = Vue.ref(window.matchMedia("(max-width: 640px)").matches);
    const isSessionRemoved = Vue.ref(false); // New state for showing the modal
    const sessionRemovedBy = Vue.ref(''); // Who removed the session

    const participantCount = Vue.computed(() => activeUsers.value.length);

    let disconnectTimeout = null;
    const DISCONNECT_DELAY = 2 * 1000;

    const history = Vue.ref(gatherLocalHistory());

    const goalCount = Vue.computed(() => (history.value.goals || []).length);
    const agentCount = Vue.computed(() => (history.value.agents || []).length);
    const documentCount = Vue.computed(() => (history.value.documents || []).length);
   
    const questionCount = Vue.computed(() => (history.value.questions || []).length);
    const answerCount = Vue.computed(() => (history.value.answers || []).length);
    const chatCount = Vue.computed(() => (history.value.chat || []).length);
    const artifactCount = Vue.computed(() => (history.value.artifacts || []).length);
    const sectionCount = Vue.computed(() => (history.value.sections || []).length);
    const promptsCount = Vue.computed(() => (history.value.prompts || []).length);

    Vue.watch(
      () => gatherLocalHistory(),
      (newHistory) => {
        history.value = newHistory;
      },
      { deep: true }
    );

    const route = VueRouter.useRoute();

    function handleSetupComplete({ channel, name }) {
      if (!isValidChannelName(channel)) {
        console.error("Invalid channel name. Use alphanumeric characters, spaces, underscores, and dashes only.");
        return;
      }
      connect(channel, name);
      sessionReady.value = true;
    }

    function resetSession() {
      clearTimeout(disconnectTimeout);
      disconnect();
      sessionStorage.removeItem("userUuid");
      sessionStorage.removeItem("displayName");
      sessionStorage.removeItem("channelName");
      userUuid.value = null;
      displayName.value = "";
      channelName.value = "";
      sessionReady.value = false;
      isRoomLocked.value = false;
      isChatOpen.value = false;
      chatWidth.value = 350;
      isSessionRemoved.value = false;
      sessionRemovedBy.value = '';
      // Reset all composable states
      agents.value = [];
      messages.value = [];
      documents.value = [];
      goals.value = [];
      questions.value = [];
      answers.value = [];
      artifacts.value = [];
      sections.value = [];
      breakouts.value = [];
      prompts.value = [];
    }

    function handleResetSession() {
      resetSession();
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        if (isConnected.value && channelName.value) {
          disconnectTimeout = setTimeout(() => {
            emit("leave-channel", {
              userUuid: userUuid.value,
              channelName: channelName.value,
            });
            disconnect();
            console.log("Disconnected due to prolonged tab inactivity");
          }, DISCONNECT_DELAY);
        }
      } else {
        clearTimeout(disconnectTimeout);
        if (!isConnected.value && channelName.value && displayName.value) {
          if (!isValidChannelName(channelName.value)) {
            console.error("Invalid channel name. Use alphanumeric characters, spaces, underscores, and dashes only.");
            return;
          }
          connect(channelName.value, displayName.value);
          console.log("Reconnected due to tab visibility, history will sync via init-state");
        }
      }
    }

    function updateActiveTab(tab, subTab = null) {
      if (tab === "Chat") {
        toggleChat();
        return;
      }
      activeTab.value = tab;
      if (tab === "Documents" && subTab) {
        activeDocumentSubTab.value = subTab;
      } else if (tab !== "Documents") {
        activeDocumentSubTab.value = "Uploads";
      }
    }

    function toggleChat() {
      isChatOpen.value = !isChatOpen.value;
    }

    function updateChatWidth(newWidth) {
      chatWidth.value = Math.max(250, newWidth);
    }

    const connectionStatusClass = Vue.computed(() => {
      if (connectionStatus.value === "connected") return "bg-[#34d399]";
      if (connectionStatus.value === "connecting") return "bg-[#f59e0b]";
      return "bg-[#64748b]";
    });

    function isValidChannelName(channelName) {
      if (!channelName || typeof channelName !== "string") return false;
      return /^[a-z0-9 _-]+$/.test(channelName);
    }

    function getTabLabel(tab) {
      switch (tab) {
        case 'Dashboard':
          return 'Dashboard';
        case 'Sections':
          return `Sections (${sections.value.length})`;
        case 'Goals':
          return `Goals (${goals.value.length})`;
        case 'Agents':
          return `Agents (${agents.value.length})`;
        case 'Q&A':
          return `Q&A (${questions.value.length} / ${answers.value.length})`;
        case 'Collaboration':
          return `Collaboration (${breakouts.value.length})`;
          case 'Prompts':
            return `Prompts (${prompts.value.length})`;
          default:
          return tab;
      }
    }

    on("update-tab", (data) => {
      console.log("Binder received update-tab:", data);
      if (data && data.tab) {
        activeTab.value = data.tab;
        if (data.tab === "Documents" && data.subTab) {
          activeDocumentSubTab.value = data.subTab;
        } else if (data.tab !== "Documents") {
          activeDocumentSubTab.value = "Uploads";
        }
      }
    });

    on("error", (errorData) => {
      if (errorData && errorData.message.includes("Failed to save state")) {
        console.error("Upload to cloud failed:", errorData.message);
        alert(`Upload failed: ${errorData.message}`);
      }
    });

    on("room-lock-toggle", (data) => {
      isRoomLocked.value = data.locked;
    });

    on("toggle-chat", () => {
      toggleChat();
    });

    on("session-removed", ({ removedBy }) => {
      isSessionRemoved.value = true;
      sessionRemovedBy.value = removedBy;
    });

    Vue.onMounted(() => {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("resize", () => {
        isMobile.value = window.matchMedia("(max-width: 640px)").matches;
      });
      const channelFromUrl = route.params.channelName;
      if (
        channelFromUrl &&
        sessionInfo.value.userUuid &&
        sessionInfo.value.displayName
      ) {
        if (!isValidChannelName(channelFromUrl)) {
          console.error(
            "Invalid channel name in URL. Use alphanumeric characters, spaces, underscores, and dashes only."
          );
          sessionReady.value = false;
          return;
        }
        console.log("Mounting Binder, loading session...");
        connect(channelFromUrl, sessionInfo.value.displayName);
        sessionReady.value = true;
      }
    });

    Vue.onUnmounted(() => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", () => {
        isMobile.value = window.matchMedia("(max-width: 640px)").matches;
      });
      clearTimeout(disconnectTimeout);
      off("update-tab");
      off("user-list");
      off("error");
      off("room-lock-toggle");
      off("toggle-chat");
      off("session-removed");
      cleanupAgents();
      cleanupChat();
      cleanupDocuments();
      cleanupGoals();
      cleanupQuestions();
      cleanupArtifacts();
      cleanupSections();
      cleanupCollaboration();
      cleanupPrompts();
    });

    Vue.watch(isConnected, (connected) => {
      if (!connected && sessionReady.value) {
        console.warn("Connection lost:", connectionError.value);
      }
    });

    return {
      sessionReady,
      activeTab,
      activeDocumentSubTab,
      tabs,
      documentSubTabs,
      handleSetupComplete,
      resetSession,
      sessionInfo,
      isConnected,
      connectionStatus,
      connectionStatusClass,
      connectionError,
      channelName,
      participantCount,
      isRoomLocked,
      isChatOpen,
      isMobile,
      toggleChat,
      chatWidth,
      updateChatWidth,
      updateActiveTab,
      getTabLabel,
      goalCount,
      agentCount,
      documentCount,
      questionCount,
      answerCount,
      chatCount,
      artifactCount,
      sectionCount,
      promptsCount,
      sections,
      goals,
      agents,
      questions,
      answers,
      breakouts,
      prompts,
      messages,
      isSessionRemoved,
      sessionRemovedBy,
      handleResetSession,
    };
  },
};