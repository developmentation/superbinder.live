// components/ChatPanel.js
import { useChat } from '../composables/useChat.js';
import { useRealTime } from '../composables/useRealTime.js';

export default {
  name: 'ChatPanel',
  template: `
    <div
      v-if="isOpen"
      class="chat-panel"
      :class="{ 'mobile': isMobile, 'translate-x-full': !isOpen }"
      :style="{ width: !isMobile ? width + 'px' : undefined, zIndex: 100 }"
    >
      <!-- Mobile Inner Container -->
      <div v-if="isMobile" class="bg-gray-900 w-full flex flex-col h-full">
        <div class="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <h3 class="text-lg font-semibold text-purple-400">Chat</h3>
          <button @click="closeChat" class="text-white hover:text-red-400">
            <i class="pi pi-times text-xl"></i>
          </button>
        </div>
        <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 scrollbar-hide" @scroll.passive="handleScroll">
          <div
            v-for="msg in allMessages"
            :key="msg.id"
            :style="{ backgroundColor: msg.isDraft ? '#4B5563' : (msg?.data?.color ? msg.data.color + '33' : '#80808033') }" 
            class="p-2 mb-2 rounded-lg flex flex-col relative message-text"
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
            <span class="text-white message-content">{{ msg.data.text }}</span>
            <span class="text-gray-400 text-xs">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div v-if="!allMessages.length" class="text-gray-400">No messages yet.</div>
        </div>
        <div class="p-4 border-t border-gray-700 flex gap-2 items-center flex-shrink-0">
          <textarea
            v-model="draft"
            @input="updateDraft"
            @keypress.enter="handleEnterKey"
            rows="3"
            class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 textarea-input"
            placeholder="Type a message..."
          ></textarea>
        </div>
      </div>
      <!-- Desktop Content -->
      <template v-else>
        <div class="p-2 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
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
        <div ref="chatContainer" class="flex-1 overflow-y-auto p-2 scrollbar-hide" @scroll.passive="handleScroll">
          <div
            v-for="msg in allMessages"
            :key="msg.id"
            :style="{ backgroundColor: msg.isDraft ? '#4B5563' : (msg?.data?.color ? msg.data.color + '33' : '#80808033') }"  
            class="p-2 mb-2 rounded-lg flex flex-col relative message-text"
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
            <span class="text-white message-content">{{ msg.data.text }}</span>
            <span class="text-gray-400 text-xs">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div v-if="!allMessages.length" class="text-gray-400">No messages yet.</div>
        </div>
        <div class="p-4 border-t border-gray-700 flex gap-2 items-center flex-shrink-0">
          <textarea
            v-model="draft"
            @input="updateDraft"
            @keypress.enter="handleEnterKey"
            rows="3"
            class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 textarea-input"
            placeholder="Type a message..."
          ></textarea>
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

    const allMessages = Vue.computed(() => {
      // Combine messages and drafts
      const combined = [
        ...messages.value.map(msg => ({ ...msg, isDraft: false })),
        ...Object.values(draftMessages.value || {}).map(msg => ({ ...msg, isDraft: true })),
      ];
      // Sort by timestamp, ensuring drafts maintain their initial order during a session
      return combined.sort((a, b) => a.timestamp - b.timestamp);
    });

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

    // Watch for changes in allMessages and only scroll if the user is at the bottom
    Vue.watch(allMessages, () => {
      if (chatContainer.value && isAutoScrollEnabled.value) {
        Vue.nextTick(() => {
          const container = chatContainer.value;
          container.scrollTop = container.scrollHeight;
        });
      }
    }, { deep: true });

    // Scroll to bottom when ChatPanel opens
    Vue.watch(
      () => props.isOpen,
      (newIsOpen) => {
        if (newIsOpen) {
          Vue.nextTick(() => {
            if (chatContainer.value) {
              const container = chatContainer.value;
              container.scrollTop = container.scrollHeight;
              console.log('Scrolled to bottom on open, container:', chatContainer.value);
            } else {
              console.warn('chatContainer is null on open');
            }
          });
          // Fallback delay to ensure DOM is ready
          setTimeout(() => {
            if (chatContainer.value) {
              const container = chatContainer.value;
              container.scrollTop = container.scrollHeight;
              console.log('Scrolled to bottom on open (fallback delay)');
            }
          }, 100); // 100ms delay as a fallback
        }
      }
    );

    function updateDraftLocally(event) {
      const text = event.target.value || '';
      updateDraft(text); // Preserve newlines as they are captured by the textarea
      console.log('Draft text with newlines:', text); // Debug log
    }

    function handleEnterKey(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent default newline in textarea
        sendFinalMessage();
      }
    }

    function sendFinalMessage() {
      if (draft.value && typeof draft.value === 'string' && draft.value.trim()) {
        console.log('Sending message with newlines:', draft.value); // Debug log
        sendMessage(draft.value); // Send the text with newlines preserved
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
      handleEnterKey,
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