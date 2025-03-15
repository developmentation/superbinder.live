// components/ChatPanel.js
import { useChat } from '../composables/useChat.js';
import { useRealTime } from '../composables/useRealTime.js';

export default {
  name: 'ChatPanel',
  template: `
    <div
      v-if="isOpen"
      class="chat-panel fixed top-0 bottom-0 flex flex-col bg-[#1a2233] z-50"
      :class="{ 'mobile': isMobile, 'right-0': !isMobile, 'inset-0': isMobile }"
      :style="{ width: !isMobile ? width + 'px' : '100%', height: isMobile ? 'calc(100vh - 198px)' : 'calc(100vh - 148px)' }"
    >
      <div class="p-3 border-b border-[#2d3748] flex justify-between items-center flex-shrink-0 bg-[#1a2233] glass-effect shadow-md">
        <h3 class="text-xl font-bold text-[#4dabf7]">Chat</h3>
        <button @click="closeChat" class="text-[#e2e8f0] hover:text-[#ef4444] transition-colors p-1 rounded-full hover:bg-[#2d3748]">
          <i class="pi pi-times text-2xl"></i>
        </button>
        <div
          v-if="!isMobile"
          class="absolute left-0 top-0 h-full w-4 cursor-col-resize bg-transparent"
          @mousedown="startResize"
          @touchstart.passive="startResize"
        ></div>
      </div>

      <div ref="chatContainer" class="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div
          v-for="msg in allMessages"
          :key="msg.id"
          class="bg-[#2d3748] p-3 mb-3 rounded-xl shadow-sm flex flex-col relative message-text"
          :style="{ backgroundColor: msg.isDraft ? '#4b5563' : (msg?.data?.color ? msg.data.color + '33' : '#4b556333') }"
        >
          <button
            v-if="!msg.isDraft && msg.id && msg.userUuid === currentUserUuid"
            @click.stop="deleteChat(msg.id)"
            @touchend.stop.prevent="deleteChat(msg.id)"
            class="absolute top-2 right-2 text-red-400 hover:text-red-300 rounded-full bg-[#3a4159] p-1 hover:bg-[#4b5563] transition-colors"
            style="width: 24px; height: 24px; line-height: 24px; font-size: 14px;"
          >
            <i class="pi pi-times"></i>
          </button>
          <span class="font-semibold text-[#e2e8f0] text-base">
            {{ getDisplayName(msg) }}:
          </span>
          <span class="text-[#e2e8f0] message-content text-sm">{{ msg.data.text }}</span>
          <span class="text-[#94a3b8] text-xs">{{ formatTime(msg.timestamp) }}</span>
        </div>
        <div v-if="!allMessages.length" class="text-[#94a3b8] text-center py-4 text-sm">No messages yet.</div>
      </div>

      <div class="p-3 border-t border-[#2d3748] flex gap-2 items-center flex-shrink-0 bg-[#1a2233] glass-effect shadow-md">
        <textarea
          v-model="draft"
          @input="updateDraft"
          @keypress.enter="handleEnterKey"
          rows="2"
          class="flex-1 p-2 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] focus:border-[#4dabf7] textarea-input text-sm placeholder-[#94a3b8]"
          placeholder="Type a message..."
        ></textarea>
        <button
          @click="sendFinalMessage"
          class="px-3 py-1 bg-[#4dabf7] text-white rounded-lg hover:bg-[#3b82f6] transition-colors text-sm"
        >
          Send
        </button>
      </div>
    </div>
  `,
  props: {
    isOpen: { type: Boolean, required: true },
    isMobile: { type: Boolean, required: true },
    width: { type: Number, default: 350 },
  },
  emits: ['close', 'update:width'],
  setup(props, { emit }) {
    const { messages, draftMessages, sendMessage, updateDraft, deleteChat, activeUsers } = useChat();
    const { userUuid: currentUserUuid } = useRealTime();
    const draft = Vue.ref('');
    const chatContainer = Vue.ref(null);
    const isAutoScrollEnabled = Vue.ref(true);

    const allMessages = Vue.computed(() => {
      const combined = [
        ...messages.value.map(msg => ({ ...msg, isDraft: false })),
        ...Object.values(draftMessages.value || {}).map(msg => ({ ...msg, isDraft: true })),
      ];
      return combined.sort((a, b) => a.timestamp - b.timestamp);
    });

    function getDisplayName(msg) {
      const user = activeUsers.value.find(user => user.userUuid === msg.userUuid);
      const baseName = user?.displayName || (msg.userUuid.startsWith('agent-') ? 'AI Agent' : 'Unknown');
      return msg.isDraft && msg.displayNameSuffix ? `${baseName} ${msg.displayNameSuffix}` : baseName;
    }

    function formatTime(timestamp) {
      if (!timestamp || isNaN(new Date(timestamp).getTime())) return 'Invalid Date';
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          const container = chatContainer.value;
          container.scrollTop = container.scrollHeight;
        });
      }
    }, { deep: true });

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
          setTimeout(() => {
            if (chatContainer.value) {
              const container = chatContainer.value;
              container.scrollTop = container.scrollHeight;
              console.log('Scrolled to bottom on open (fallback delay)');
            }
          }, 100);
        }
      }
    );

    function updateDraftLocally(event) {
      const text = event.target.value || '';
      updateDraft(text);
      console.log('Draft text with newlines:', text);
    }

    function handleEnterKey(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendFinalMessage();
      }
    }

    function sendFinalMessage() {
      if (draft.value && typeof draft.value === 'string' && draft.value.trim()) {
        console.log('Sending message with newlines:', draft.value);
        sendMessage(draft.value);
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
      const newWidth = Math.max(250, startWidth - diff);
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