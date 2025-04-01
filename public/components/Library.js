// components/Library.js
import { useLibrary } from '../composables/useLibrary.js';

export default {
  name: 'Library',
  template: `
    <div class="h-full flex flex-col overflow-hidden p-4 bg-gray-900">
      <!-- Hero Banner -->
      <div class="mb-6 text-center py-12 bg-gradient-to-r from-indigo-900 via-gray-900 to-purple-900 rounded-lg">
        <h1 class="text-4xl font-bold text-white mb-4">SuperBinder Library</h1>
        <p class="text-gray-200 text-lg max-w-2xl mx-auto leading-relaxed">
          Discover and deploy community-crafted binders—packed with prompts, goals, and AI agents—to supercharge your projects instantly.
        </p>
      </div>

      <!-- Filter Bar -->
      <div class="mb-4 flex gap-2">
        <input
          v-model="filterQuery"
          @input="filterArtifacts"
          type="text"
          class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          placeholder="Filter binders by name or description..."
        />
      </div>

      <!-- Artifacts Grid (Scrollable) -->
      <div class="flex-1 overflow-y-auto space-y-4" ref="artifactsContainer">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="artifact in filteredArtifacts"
            :key="artifact.uuid"
            class="p-4 rounded-lg flex flex-col justify-between cursor-pointer transition-colors relative h-48 bg-gray-800 hover:bg-gray-700"
          >
            <div class="absolute inset-0" :style="{ backgroundImage: \`url(\${artifact.data.image})\`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3 }"></div>
            <div class="relative z-10 flex flex-col h-full justify-between">
              <div>
                <h3 class="text-xl font-semibold text-white mb-2">{{ artifact.data.name }}</h3>
                <p class="text-gray-300 mb-4 line-clamp-2">{{ artifact.data.description.substring(0, 50) }}...</p>
              </div>
              <div class="flex justify-between items-center">
                <div class="flex gap-2">
                  <button @click.stop="vote(artifact.uuid, 'up')" class="py-1 px-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                    <i class="pi pi-arrow-up"></i> {{ artifact.data.votes }}
                  </button>
                  <button @click.stop="vote(artifact.uuid, 'down')" class="py-1 px-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                    <i class="pi pi-arrow-down"></i>
                  </button>
                </div>
                <button @click.stop="openDeployModal(artifact)" class="py-1 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
                  Deploy
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="filteredArtifacts.length === 0" class="text-gray-400 text-center">No binders found.</div>
        <div class="h-[200px]"></div>
      </div>

      <!-- Deploy Modal -->
      <div v-if="isDeployModalOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
          <h2 class="text-lg font-semibold text-purple-400 mb-4">Deploy Binder</h2>
          <div class="space-y-4">
            <h3 class="text-white">{{ selectedArtifact.data.name }}</h3>
            <p class="text-gray-300">{{ selectedArtifact.data.description }}</p>
            <img :src="selectedArtifact.data.image" alt="Binder Thumbnail" class="w-full max-w-[480px] rounded-lg mb-4">
            <input
              v-model="deployChannelName"
              type="text"
              class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              placeholder="New Binder Name"
            />
            <p v-if="libraryError" class="text-red-500 text-sm">{{ libraryError }}</p>
          </div>
          <div class="mt-4 flex gap-2 justify-end">
            <button @click="closeDeployModal" class="py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancel</button>
            <button @click="deploy" :disabled="libraryLoading" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
              {{ libraryLoading ? 'Deploying...' : 'Deploy' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const { libraryArtifacts, loading: libraryLoading, error: libraryError, fetchLibrary, voteArtifact, deployArtifact } = useLibrary();

    const router = VueRouter.useRouter();


    const filterQuery = Vue.ref('');
    const isDeployModalOpen = Vue.ref(false);
    const selectedArtifact = Vue.ref(null);
    const deployChannelName = Vue.ref('');

    const filteredArtifacts = Vue.computed(() => {
      if (!filterQuery.value) return libraryArtifacts.value;
      const query = filterQuery.value.toLowerCase();
      return libraryArtifacts.value.filter(artifact =>
        artifact.data.name.toLowerCase().includes(query) ||
        artifact.data.description.toLowerCase().includes(query)
      );
    });

    function filterArtifacts() {
      // Handled by filteredArtifacts computed property
    }

    async function vote(uuid, direction) {
      try {
        await voteArtifact(uuid, direction);
      } catch (err) {
        // Error handled by useLibrary
      }
    }

    function openDeployModal(artifact) {
      selectedArtifact.value = artifact;
      deployChannelName.value = '';
      isDeployModalOpen.value = true;
    }

    function closeDeployModal() {
      isDeployModalOpen.value = false;
      selectedArtifact.value = null;
    }

    async function deploy() {
      if (!deployChannelName.value) {
        libraryError.value = 'Channel name is required';
        return;
      }
      try {
        await deployArtifact(selectedArtifact.value.uuid, deployChannelName.value);
        router.push(`/binder/${deployChannelName.value}`);
        // closeDeployModal();
      } catch (err) {
        // Error handled by useLibrary
      }
    }

    Vue.onMounted(async () => {
      await fetchLibrary();
    });

    return {
      libraryArtifacts,
      libraryLoading,
      libraryError,
      filterQuery,
      filteredArtifacts,
      isDeployModalOpen,
      selectedArtifact,
      deployChannelName,
      filterArtifacts,
      vote,
      openDeployModal,
      closeDeployModal,
      deploy,
    };
  },
};