// components/Binder.js
import { useRealTime } from "../composables/useRealTime.js";
import { useHistory } from "../composables/useHistory.js";
import SessionSetup from "./SessionSetup.js";
import ViewerUploads from "./ViewerUploads.js";
import Viewer from "./Viewer.js";
import ChatPanel from "./ChatPanel.js";
import ViewerDashboard from "./ViewerDashboard.js";
import { useAgents } from "../composables/useAgents.js";
import { useChat } from "../composables/useChat.js";
import { useClips } from "../composables/useClips.js";
import { useDocuments } from "../composables/useDocuments.js";
import { useGoals } from "../composables/useGoals.js";
import { useQuestions } from "../composables/useQuestions.js";
import { useArtifacts } from "../composables/useArtifacts.js";
import { useTranscripts } from "../composables/useTranscripts.js";

export default {
  name: "Binder",
  components: {
    SessionSetup,
    ViewerUploads,
    Viewer,
    ChatPanel,
    ViewerDashboard,
  },
  template: `
    <div class="flex flex-col min-h-screen text-white p-2 overflow-x-hidden" style="height: 100vh; position: relative;">
      <session-setup v-if="!sessionReady" @setup-complete="handleSetupComplete" />

      <div v-if="sessionReady" class="flex flex-col h-full relative">
        <!-- Menu Bar -->
        <div class="bg-gray-800 p-2 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-2">
          <div class="flex items-center space-x-2">
            <span class="text-lg font-semibold text-gray-100">Channel: '{{ channelName }}' ({{ participantCount }} participants)</span>
          </div>
          <div class="flex items-center space-x-2 sm:ml-auto">
            <button @click="resetSession" class="p-2 text-white hover:text-purple-400" title="Reset Session">
              <i class="pi pi-sign-out text-xl"></i>
            </button>
            <button @click="toggleRoomLock" class="p-2 text-white hover:text-purple-400" :class="{ 'text-green-500': !isRoomLocked, 'text-red-500': isRoomLocked }" title="Toggle Room Lock">
              <i v-if="!isRoomLocked" class="pi pi-unlock text-xl"></i>
              <i v-if="isRoomLocked" class="pi pi-lock text-xl"></i>
            </button>
            <span :class="connectionStatusClass" class="inline-block w-4 h-4 rounded-full mr-2" title="Connection Status"></span>
          </div>
        </div>

        <!-- Tab Bar with Chat Icon -->
        <div class="bg-gray-900 border-b border-gray-700 px-4 py-2 relative flex items-center">
          <div class="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              v-for="tab in tabs"
              :key="tab"
              @click="activeTab = tab; updateActiveTab(tab)"
              class="px-4 py-2 rounded-t-lg font-semibold transition-colors whitespace-nowrap"
              :class="[activeTab === tab ? 'bg-gray-800 text-purple-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600']"
            >
              {{ getTabLabel(tab) }}
            </button>
          </div>
          <button
            @click="toggleChat"
            class="ml-auto px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors hidden sm:inline-flex"
            :class="{ 'bg-gray-800 text-purple-400': isChatOpen }"
          >
            <i class="pi pi-comments text-xl"></i>
          </button>
        </div>

        <!-- Main Content -->
        <div class="flex flex-1 flex-col overflow-hidden relative" style="height: 100%;">
          <!-- Conditionally show main content only when chat is not open on mobile -->
          <div v-show="!isMobile || !isChatOpen" class="flex-1 flex flex-col overflow-hidden">
            <!-- Document Sub-Tabs (only when Documents tab is active) -->
            <div v-show="activeTab === 'Documents'" class="bg-gray-900 border-b border-gray-700 px-4 py-2">
              <div class="flex gap-2 overflow-x-auto scrollbar-hide">
                <button
                  v-for="subTab in documentSubTabs"
                  :key="subTab"
                  @click="activeDocumentSubTab = subTab; updateActiveTab('Documents')"
                  class="px-4 py-2 rounded-t-lg font-semibold transition-colors whitespace-nowrap"
                  :class="[activeDocumentSubTab === subTab ? 'bg-gray-800 text-purple-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600']"
                >
                  {{ subTab }}
                </button>
              </div>
            </div>

            <!-- Viewer -->
            <div 
              class="flex-1 overflow-y-auto" 
            
            > <!--   :style="{ maxHeight: activeTab === 'Documents' ? 'calc(100vh - 300px)' : 'calc(100vh - 200px)' }"-->
              <viewer
                :active-tab="activeTab"
                :active-document-sub-tab="activeDocumentSubTab"
                :update-tab="updateActiveTab"
                v-show="true"
                class="w-full h-full"
              />
            </div>
          </div>

          <!-- Chat Button (Always visible on mobile, hidden on desktop) -->
          <button
            @click="toggleChat"
            class="fixed bottom-4 right-4 p-3 bg-purple-600 text-white rounded-full shadow-lg z-50 sm:hidden"
            :class="{ 'bg-gray-800': isChatOpen }"
          >
            <i class="pi pi-comments text-xl"></i>
          </button>
        </div>

        <!-- Chat Panel (Moved to Binder.js level) -->
        <chat-panel
          v-show="isChatOpen"
          :is-open="isChatOpen"
          :is-mobile="isMobile"
          :width="chatWidth"
          @close="toggleChat"
          @update:width="updateChatWidth"
          class="chat-panel"
          :class="{ 'mobile': isMobile }"
          :style="{ width: !isMobile ? \`\${chatWidth}px\` : undefined, zIndex: 100 }"
        />
      </div>
    </div>
  `,
  setup() {
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
    } = useRealTime();
    const { gatherLocalHistory } = useHistory();
    const sessionReady = Vue.ref(false);
    const activeTab = Vue.ref("Dashboard");
    const activeDocumentSubTab = Vue.ref("Uploads");
    const tabs = ["Dashboard", "Documents", "Goals", "Agents", "Q&A"];
    const documentSubTabs = ["Uploads", "Viewer", "Clips", "Bookmarks"];
    const isRoomLocked = Vue.ref(false);
    const isChatOpen = Vue.ref(false);
    const chatWidth = Vue.ref(300);
    const { userUuid, displayName, channelName } = useRealTime();

    const { agents, cleanup: cleanupAgents } = useAgents();
    const { messages, cleanup: cleanupChat } = useChat();
    const { clips, cleanup: cleanupClips } = useClips();
    const { documents, cleanup: cleanupDocuments } = useDocuments();
    const { goals, cleanup: cleanupGoals } = useGoals();
    const { questions, cleanup: cleanupQuestions } = useQuestions();
    const { artifacts, cleanup: cleanupArtifacts } = useArtifacts();
    const { transcripts, cleanup: cleanupTranscripts } = useTranscripts();

    const isMobile = Vue.ref(window.matchMedia("(max-width: 640px)").matches);
    const updateIsMobile = () => {
      isMobile.value = window.matchMedia("(max-width: 640px)").matches;
    };
    window.addEventListener("resize", updateIsMobile);

    const participantCount = Vue.computed(() => activeUsers.value.length);

    let disconnectTimeout = null;
    const DISCONNECT_DELAY = 2 * 1000;

    const history = Vue.ref(gatherLocalHistory());

    const goalCount = Vue.computed(() => (history.value.goals || []).length);
    const agentCount = Vue.computed(() => (history.value.agents || []).length);
    const documentCount = Vue.computed(() => (history.value.documents || []).length);
    const clipCount = Vue.computed(() => (history.value.clips || []).length);
    const bookmarkCount = Vue.computed(() => (history.value.bookmarks || []).length);
    const transcriptCount = Vue.computed(() => (history.value.transcripts || []).length);
    const questionCount = Vue.computed(() => (history.value.questions || []).length);
    const answerCount = Vue.computed(() => (history.value.answers || []).length);
    const chatCount = Vue.computed(() => (history.value.chat || []).length);
    const artifactCount = Vue.computed(() => (history.value.artifacts || []).length);

    Vue.watch(
      () => gatherLocalHistory(),
      (newHistory) => {
        history.value = newHistory;
      },
      { deep: true }
    );

    function handleSetupComplete({ channel, name }) {
      if (!isValidChannelName(channel)) {
        console.error(
          "Invalid channel name. Use alphanumeric characters and underscores only."
        );
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
      chatWidth.value = 300;
    }

    function toggleRoomLock() {
      isRoomLocked.value = !isRoomLocked.value;
      emit("room-lock-toggle", {
        channelName: channelName.value,
        locked: isRoomLocked.value,
      });
    }

    function downloadFromCloud() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const data = JSON.parse(event.target.result);
            if (data && Object.keys(data).length > 0) {
              syncChannelData(data);
            } else {
              console.warn(
                "Empty or undefined data downloaded, skipping sync:",
                data
              );
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
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
            console.error(
              "Invalid channel name. Use alphanumeric characters and underscores only."
            );
            return;
          }
          connect(channelName.value, displayName.value);
          console.log(
            "Reconnected due to tab visibility, history will sync via init-state"
          );
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
      emit("update-tab", {
        tab: tab,
        subTab: tab === "Documents" ? activeDocumentSubTab.value : null,
      });
    }

    function toggleChat() {
      isChatOpen.value = !isChatOpen.value;
    }

    function updateChatWidth(newWidth) {
      chatWidth.value = Math.max(200, newWidth);
    }

    const connectionStatusClass = Vue.computed(() => {
      if (connectionStatus.value === "connected") return "bg-green-500";
      if (connectionStatus.value === "connecting") return "bg-yellow-500";
      return "bg-gray-500";
    });

    function isValidChannelName(channelName) {
      if (!channelName || typeof channelName !== "string") return false;
      return /^[a-zA-Z0-9_]+$/.test(channelName);
    }

    function getTabLabel(tab) {
      switch (tab) {
        case 'Dashboard': return 'Dashboard';
        case 'Goals': return `Goals (${goalCount.value})`;
        case 'Agents': return `Agents (${agentCount.value})`;
        case 'Documents': return `Documents (${documentCount.value})`;
        case 'Clips': return `Clips (${clipCount.value})`;
        case 'Bookmarks': return `Bookmarks (${bookmarkCount.value})`;
        case 'Transcriptions': return `Transcriptions (${transcriptCount.value})`;
        case 'Q&A': return `Q&A (${questionCount.value} / ${answerCount.value})`;
        default: return tab;
      }
    }

    on("update-tab", (data) => {
      console.log("Binder received update-tab:", data);
      if (data.tab) {
        activeTab.value = data.tab;
        if (data.tab === "Documents" && data.subTab) {
          activeDocumentSubTab.value = data.subTab;
        } else if (data.tab !== "Documents") {
          activeDocumentSubTab.value = "Uploads";
        }
      }
    });

    on("error", (errorData) => {
      if (errorData.message.includes("Failed to save state")) {
        console.error("Upload to cloud failed:", errorData.message);
        alert(`Upload failed: ${errorData.message}`);
      }
    });

    on("room-lock-toggle", (data) => {
      if (data.channelName === channelName.value) {
        isRoomLocked.value = data.locked;
      }
    });

    on("toggle-chat", () => {
      toggleChat();
    });

    Vue.onMounted(() => {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("resize", updateIsMobile);
      if (
        sessionInfo.value.userUuid &&
        sessionInfo.value.channelName &&
        sessionInfo.value.displayName
      ) {
        if (!isValidChannelName(sessionInfo.value.channelName)) {
          console.error(
            "Invalid channel name in session info. Use alphanumeric characters and underscores only."
          );
          sessionReady.value = false;
          return;
        }
        console.log("Mounting Binder, loading session...");
        loadSession();
        sessionReady.value = true;
      }
    });

    Vue.onUnmounted(() => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", updateIsMobile);
      clearTimeout(disconnectTimeout);
      off("update-tab");
      off("user-list");
      off("error");
      off("room-lock-toggle");
      off("toggle-chat");
      cleanupAgents();
      cleanupChat();
      cleanupClips();
      cleanupDocuments();
      cleanupGoals();
      cleanupQuestions();
      cleanupArtifacts();
      cleanupTranscripts();
    });

    Vue.watch(isConnected, (connected) => {
      if (!connected && sessionReady.value) {
        // console.warn("Connection lost:", connectionError.value);
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
      toggleRoomLock,
      downloadFromCloud,
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
      clipCount,
      bookmarkCount,
      transcriptCount,
      questionCount,
      answerCount,
      chatCount,
      artifactCount,
    };
  },
};