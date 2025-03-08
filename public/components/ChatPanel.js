// components/ChatPanel.js
import { useChat } from '../composables/useChat.js';
import { useRealTime } from '../composables/useRealTime.js';

export default {
  name: 'ChatPanel',
  template: `
    <div
      v-if="isOpen"
      class="chat-panel fixed right-0 bg-gray-900 border-l border-gray-700 shadow-lg flex flex-col transform transition-transform duration-300"
      :class="{ 'translate-x-full': !isOpen, 'z-50 inset-0 bg-black bg-opacity-50 flex justify-end': isMobile, 'absolute top-0': !isMobile }"
      :style="{
        width: isMobile ? '100%' : width + 'px',
        height: isMobile ? 'calc(100vh - 96px)' : 'calc(100vh - 200px)',   
        maxHeight: isMobile ? 'calc(100vh - 96px)' : 'calc(100vh - 200px)'  
      }"
    >
      <!-- Mobile Inner Container -->
      <div v-if="isMobile" class="bg-gray-900 h-full w-full border-l border-gray-700 shadow-lg flex flex-col">
        <div class="p-4 border-b border-gray-700 flex justify-between items-center">
          <h3 class="text-lg font-semibold text-purple-400">Chat</h3>
          <button @click="closeChat" class="text-white hover:text-red-400">
            <i class="pi pi-times text-xl"></i>
          </button>
        </div>
        <div ref="chatContainer" class="flex-1 overflow-y-auto p-4" @scroll.passive="handleScroll">
          <div
            v-for="msg in allMessages"
            :key="msg.id"
            :style="{ backgroundColor: msg.isDraft ? '#4B5563' : (msg?.data?.color ? msg.data.color + '33' : '#80808033') }" 
            class="p-2 mb-2 rounded-lg flex flex-col relative"
          >
            <button
              v-if="!msg.isDraft && msg.id && msg.userUuid === currentUserUuid" 
              @click.stop="deleteChat(msg.id)"
              @touchend.stop.prevent="deleteChat(msg.id)"
              class="absolute top-1 right-1 text-red-400 hover:text-red-300 rounded-full bg-gray-800"
              style="width: 24px; height: 24px; line-height: 24px; font-size: 16px;"
            >
              <i class="pi pi-times"></i>
            </button>
            <span class="font-semibold text-white">
              {{ getDisplayName(msg) }}:
            </span>
            <span class="text-white">{{ msg.data.text }}</span>
            <span class="text-gray-400 text-xs">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div v-if="!allMessages.length" class="text-gray-400">No messages yet.</div>
        </div>
        <div class="p-4 border-t border-gray-700 flex gap-2 items-center">
          <input
            v-model="draft"
            @input="updateDraft"
            @keypress.enter="sendFinalMessage"
            type="text"
            class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500"
            placeholder="Type a message..."
          />
          <button
            @click="sendFinalMessage"
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            Send
          </button>
        </div>
      </div>
      <!-- Desktop Content -->
      <template v-else>
        <div class="p-2 border-b border-gray-700 flex justify-between items-center relative">
          <h3 class="text-lg font-semibold text-purple-400">Chat</h3>
          <button @click="closeChat" class="text-white hover:text-red-400">
            <i class="pi pi-times text-xl"></i>
          </button>
          <div
            class="absolute left-0 top-0 h-full w-4 cursor-col-resize bg-transparent"
            @mousedown="startResize"
            @touchstart.passive="startResize"
          ></div>
        </div>
        <div ref="chatContainer" class="flex-1 overflow-y-auto p-2" @scroll.passive="handleScroll">
          <div
            v-for="msg in allMessages"
            :key="msg.id"
            :style="{ backgroundColor: msg.isDraft ? '#4B5563' : (msg?.data?.color ? msg.data.color + '33' : '#80808033') }"  
            class="p-2 mb-2 rounded-lg flex flex-col relative"
          >
            <button
              v-if="!msg.isDraft && msg.id && msg.userUuid === currentUserUuid"  
              @click.stop="deleteChat(msg.id)"
              @touchend.stop.prevent="deleteChat(msg.id)"
              class="absolute top-1 right-1 text-red-400 hover:text-red-300 p-1 rounded-full bg-gray-800"
              style="width: 24px; height: 24px; line-height: 24px; font-size: 14px;"
            >
              <i class="pi pi-times"></i>
            </button>
            <span class="font-semibold text-white">
              {{ getDisplayName(msg) }}:
            </span>
            <span class="text-white">{{ msg.data.text }}</span>
            <span class="text-gray-400 text-xs">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div v-if="!allMessages.length" class="text-gray-400">No messages yet.</div>
        </div>
        <div class="p-2 border-t border-gray-700 flex gap-2 items-center">
          <input
            v-model="draft"
            @input="updateDraft"
            @keypress.enter="sendFinalMessage"
            type="text"
            class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500"
            placeholder="Type a message..."
          />
          <button
            @click="sendFinalMessage"
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            Send
          </button>
        </div>
      </template>
    </div>
  `,
  props: {
    isOpen: { type: Boolean, required: true },
    isMobile: { type: Boolean, required: true },
    width: { type: Number, default: 300 },
  },
  emits: ['close', 'update:width'],
  setup(props, { emit }) {
    const { messages, draftMessages, sendMessage, updateDraft, deleteChat, activeUsers } = useChat();
    const { userUuid: currentUserUuid } = useRealTime();
    const draft = Vue.ref('');
    const chatContainer = Vue.ref(null);
    const isAutoScrollEnabled = Vue.ref(true);

    const allMessages = Vue.computed(() => [
      ...messages.value.map(msg => ({ ...msg, isDraft: false })),
      ...Object.values(draftMessages.value || {}).map(msg => ({ ...msg, isDraft: true })),
    ].sort((a, b) => a.timestamp - b.timestamp));

    function getDisplayName(msg) {
      const user = activeUsers.value.find(user => user.userUuid === msg.userUuid);
      const baseName = user?.displayName || (msg.userUuid.startsWith('agent-') ? 'AI Agent' : 'Unknown');
      return msg.isDraft && msg.displayNameSuffix ? `${baseName} ${msg.displayNameSuffix}` : baseName;
    }

    function formatTime(timestamp) {
      if (!timestamp || isNaN(new Date(timestamp).getTime())) return 'Invalid Date';
      return new Date(timestamp).toLocaleTimeString();
    }

    function closeChat() {
      emit('close');
    }

    function handleScroll() {
      if (!chatContainer.value) return;
      const container = chatContainer.value;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 5;
      isAutoScrollEnabled.value = isAtBottom;
    }

    Vue.watch(allMessages, () => {
      if (chatContainer.value && isAutoScrollEnabled.value) {
        Vue.nextTick(() => {
          chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        });
      }
    }, { deep: true });

    function updateDraftLocally(event) {
      const text = event.target.value || '';
      updateDraft(text);
    }

    function sendFinalMessage() {
      if (draft.value && typeof draft.value === 'string' && draft.value.trim()) {
        sendMessage(draft.value.trim());
        draft.value = '';
      } else {
        console.warn('No valid text to send in draft:', draft.value);
      }
    }

    let startX = 0;
    let startWidth = 0;

    function startResize(event) {
      startX = event.type === 'mousedown' ? event.pageX : event.touches[0].pageX;
      startWidth = props.width;
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResize);
      document.addEventListener('touchmove', resize);
      document.addEventListener('touchend', stopResize);
    }

    function resize(event) {
      const x = event.type === 'mousemove' ? event.pageX : event.touches[0].pageX;
      const diff = x - startX;
      const newWidth = Math.max(200, startWidth - diff);
      emit('update:width', newWidth);
    }

    function stopResize() {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('touchmove', resize);
      document.removeEventListener('touchend', stopResize);
    }

    Vue.onUnmounted(() => {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('touchmove', resize);
      document.removeEventListener('touchend', stopResize);
    });

    return {
      allMessages,
      draft,
      sendFinalMessage,
      updateDraft: updateDraftLocally,
      deleteChat,
      activeUsers,
      formatTime,
      getDisplayName,
      chatContainer,
      handleScroll,
      closeChat,
      startResize,
      currentUserUuid,
    };
  },
};