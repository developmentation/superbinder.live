// App.js
import { useRealTime } from "./composables/useRealTime.js";
import { useModels } from "./composables/useModels.js";
import { useTextToSpeech } from "./composables/useTextToSpeech.js";
import { useConfigs } from "./composables/useConfigs.js";
import router from "../router/index.js";
import Binder from "./components/Binder.js";

export default {
  template: `
    <div class="min-h-screen bg-[#0a0f1e] flex flex-col">
      <input type="file" ref="fileInput" style="display: none;" @change="handleFileUpload" accept=".json"/>

      <!-- Navigation Bar -->
      <nav class="bg-[#1e293b] shadow-lg border-b border-[#2d3748] glass-effect">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-12 items-center">
            <div class="flex items-center">
              <!-- Logo -->
              <router-link to="/" class="flex-shrink-0 flex items-center text-[#34d399] font-semibold text-xl tracking-tight">
                SuperBinder
              </router-link>

              <!-- Desktop Menu -->
              <div class="hidden sm:ml-6 sm:flex sm:space-x-6">
                <router-link
                  v-for="item in menuItems"
                  :key="item.label"
                  :to="item.to"
                  class="text-[#e2e8f0] hover:text-[#34d399] px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-md"
                  :class="{ 'bg-[#2d3748] text-[#34d399]': $route.path === item.to }"
                >
                  {{ item.label }}
                </router-link>
              </div>
            </div>

            <!-- Right Side (Desktop: Connectivity and Logout) -->
            <div class="hidden sm:flex items-center space-x-4">
              <!-- Connectivity Indicator -->
              <span :class="connectionStatusClass" class="inline-block w-4 h-4 rounded-full" title="Connection Status"></span>
              <!-- Logout Button -->
              <button @click="resetSession" class="p-2 text-[#e2e8f0] hover:text-[#ef4444] transition-colors" title="Reset Session">
                <i class="pi pi-sign-out text-xl"></i>
              </button>
            </div>

            <!-- Mobile Menu Button and Connectivity -->
            <div class="flex sm:hidden items-center space-x-2">
              <!-- Connectivity Indicator -->
              <span :class="connectionStatusClass" class="inline-block w-4 h-4 rounded-full" title="Connection Status"></span>
              <!-- Hamburger Menu -->
              <button @click="toggleMenu" type="button" class="text-[#e2e8f0] hover:text-[#34d399] p-2 rounded-md">
                <span class="sr-only">Open main menu</span>
                <svg v-if="!menuOpen" class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg v-else class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile Menu -->
        <div class="sm:hidden" v-show="menuOpen">
          <div class="px-2 pt-2 pb-3 space-y-1 bg-[#1e293b] border-t border-[#2d3748]">
            <router-link
              v-for="item in menuItems"
              :key="item.label"
              :to="item.to"
              class="block px-3 py-2 text-base font-medium text-[#e2e8f0] hover:text-[#34d399] hover:bg-[#2d3748] rounded-md"
              :class="{ 'bg-[#2d3748] text-[#34d399]': $route.path === item.to }"
            >
              {{ item.label }}
            </router-link>
            <!-- Logout Button in Mobile Menu -->
            <button @click="resetSession" class="w-full text-left px-3 py-2 text-base font-medium text-[#e2e8f0] hover:text-[#ef4444] hover:bg-[#2d3748] rounded-md">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <!-- Main Content -->
      <main class="flex-1 overflow-hidden">
        <!-- Render Binder.js directly when on /binder route -->
        <binder v-if="$route.path === '/binder'" ref="binderRef" />
        <!-- Render router-view for other routes (e.g., Landing.js) -->
        <router-view v-else></router-view>
      </main>
    </div>
  `,
  components: {
    Binder,
  },
  setup() {
    const { getConfigs } = useConfigs();
    const { fetchServerModels } = useModels();
    const { loadVoices } = useTextToSpeech();
    const { isConnected, connectionStatus, disconnect, userUuid, displayName, channelName } = useRealTime();

    const fileInput = Vue.ref(null);
    const menuOpen = Vue.ref(false);
    const projects = Vue.ref([]);
    const binderRef = Vue.ref(null);

    const menuItems = [
      { label: "Home", to: "/" },
      { label: "Binder", to: "/binder" },
      { label: "Library", to: "/library" },
    ];

    function triggerFileInput() {
      fileInput.value.click();
    }

    Vue.onMounted(async () => {
      await loadVoices();
      await getConfigs();
      await fetchServerModels();
    });

    function handleFileUpload(event) {
      const file = event.target.files[0];
      if (file && file.type === "application/json") {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            // Handle file upload logic if needed
          } catch (error) {
            console.error("Failed to parse JSON file", error);
          }
        };
        reader.readAsText(file);
      } else {
        alert("Please upload a valid JSON file.");
      }
    }

    function download() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects.value));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "Logic Studio Profile.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }

    function toggleMenu() {
      menuOpen.value = !menuOpen.value;
    }

    function resetSession() {
      disconnect();
      sessionStorage.removeItem("userUuid");
      sessionStorage.removeItem("displayName");
      sessionStorage.removeItem("channelName");
      sessionStorage.removeItem("userColor");
      userUuid.value = null;
      displayName.value = "";
      channelName.value = "";
      if (binderRef.value && binderRef.value.resetSession) {
        binderRef.value.resetSession();
      }
      router.push("/");
    }

    const connectionStatusClass = Vue.computed(() => {
      if (connectionStatus.value === "connected") return "bg-[#34d399]";
      if (connectionStatus.value === "connecting") return "bg-[#f59e0b]";
      return "bg-[#64748b]";
    });

    return { download, triggerFileInput, handleFileUpload, fileInput, menuOpen, toggleMenu, projects, menuItems, connectionStatusClass, resetSession, binderRef };
  },
};