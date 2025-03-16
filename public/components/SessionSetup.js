import { useRealTime } from '../composables/useRealTime.js';
import { useConfigs } from '../composables/useConfigs.js';

export default {
  name: 'SessionSetup',
  template: `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
      <div class="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 class="text-2xl font-bold text-white mb-4">Create a SuperBinder</h2>
        <div v-if="errorMessage" class="mb-4 p-2 bg-red-600 text-white rounded-lg">{{ errorMessage }}</div>
        <form @submit.prevent="submitSetup">
          <div class="mb-4">
            <label class="block text-gray-300 mb-2">Display Name *</label>
            <input
              v-model="displayName"
              type="text"
              class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              placeholder="Your name"
              required
            />
          </div>
          <div class="mb-4">
            <label class="block text-gray-300 mb-2">Channel Name *</label>
            <input
              v-model="channelName"
              type="text"
              class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              placeholder="Channel to join or create (alphanumeric, space, underscore, dash)"
              required
              @input="updateChannelName"
            />
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              class="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              Join 
            </button>

            <button
              type="button"
              @click="createUuid"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              title="Unique Channel"
            >
              <i class="pi pi-key"></i>
              <span>Unique Channel</span>
            </button>

            <button
              type="button"
              @click="copyLink"
              :disabled="!channelName || channelName.trim().length === 0"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              title="Copy URL"
            >
              <i class="pi pi-link"></i>
              <span>Copy URL</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  setup(props, { emit }) {
    const displayName = Vue.ref('');
    const channelName = Vue.ref('');
    const channelId = Vue.ref('');
    const errorMessage = Vue.ref('');
    const route = VueRouter.useRoute();
    const router = VueRouter.useRouter();
    const { env } = useConfigs();
    const { connect, on } = useRealTime();

    // Prepopulate channelName from URL
    Vue.onMounted(() => {
      const channelFromUrl = route.params.channelName;
      if (channelFromUrl) {
        channelName.value = channelFromUrl.toLowerCase();
      }
    });

    function updateChannelName() {
      // Normalize channel name: lowercase and remove invalid characters
      channelName.value = channelName.value.toLowerCase();
      const cleanChannel = channelName.value.replace(/[^a-z0-9 _-]/g, '');
      if (channelName.value !== cleanChannel) {
        channelName.value = cleanChannel;
      }
    }

    function submitSetup() {
      if (displayName.value && channelName.value) {
        if (!isValidChannelName(channelName.value)) {
          errorMessage.value = 'Invalid channel name. Use alphanumeric characters, spaces, underscores, and dashes only.';
          return;
        }
        // Update URL only on form submission
        router.push(`/binder/${channelName.value}`);
        connect(channelName.value, displayName.value);
        emit('setup-complete', {
          channel: channelName.value,
          name: displayName.value,
        });
      }
    }

    function createUuid()
    {
      channelName.value = uuidv4()
    }

    function copyLink() {
      const link = `${env.value.API_URL}/binder/${channelName.value}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link)
          .catch(err => {
            console.error('Clipboard API error:', err);
            fallbackCopy(link);
          });
      } else {
        fallbackCopy(link);
      }
    }

    function fallbackCopy(text) {
      const tempInput = document.createElement('input');
      document.body.appendChild(tempInput);
      tempInput.value = text;
      tempInput.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed:', err);
        errorMessage.value = 'Failed to copy link.';
      } finally {
        document.body.removeChild(tempInput);
      }
    }

    function isValidChannelName(channelName) {
      if (!channelName || typeof channelName !== 'string') return false;
      return /^[a-z0-9 _-]+$/.test(channelName);
    }

    return {
      displayName,
      channelName,
      errorMessage,
      submitSetup,
      copyLink,
      updateChannelName,
      createUuid
    };
  },
};