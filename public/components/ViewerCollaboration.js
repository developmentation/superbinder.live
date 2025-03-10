// components/ViewerCollaboration.js
import { useCollaboration } from '../composables/useCollaboration.js';
import { useRealTime } from '../composables/useRealTime.js';
import { useAgents } from '../composables/useAgents.js';

export default {
  name: 'ViewerCollaboration',
  template: `
    <div class="h-full flex overflow-hidden">
      <!-- Breakout Rooms Sidebar -->
      <div class="w-64 bg-gray-900 flex-shrink-0 border-r border-gray-700 flex flex-col">
        <div class="p-4 border-b border-gray-700 flex justify-between items-center">
          <h3 class="text-lg font-semibold text-purple-400">Breakout Rooms</h3>
          <button @click="addBreakoutLocal" class="text-white hover:text-green-400">
            <i class="pi pi-plus"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="breakout in breakouts"
            :key="breakout.id"
            @click="selectBreakout(breakout.id)"
            class="p-2 cursor-pointer hover:bg-gray-800 flex justify-between items-center"
            :class="{ 'bg-gray-800': currentBreakoutId === breakout.id }"
          >
            <div class="flex items-center flex-1">
              <span v-if="!editing[breakout.id]" class="text-white">{{ breakout.data.name }}</span>
              <input
                v-else
                v-model="editing[breakout.id].name"
                @input="updateBreakoutName(breakout.id)"
                @blur="saveBreakoutName(breakout.id)"
                @keypress.enter="saveBreakoutName(breakout.id)"
                class="bg-gray-700 text-white border border-gray-600 rounded p-1 w-full"
              />
              <button
                @click.stop="toggleEdit(breakout.id)"
                class="ml-2 text-gray-400 hover:text-gray-200"
              >
                <i class="pi pi-pencil"></i>
              </button>
            </div>
            <button @click.stop="deleteBreakout(breakout.id)" class="text-red-400 hover:text-red-300">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div v-if="!breakouts.length" class="p-2 text-gray-400">No breakout rooms yet.</div>
        </div>
      </div>
      <!-- Chat Area -->
      <div class="flex-1 flex flex-col bg-gray-900">
        <div class="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <h3 class="text-lg font-semibold text-purple-400">{{ currentBreakout?.data.name || 'Select a Breakout' }}</h3>
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
              @click.stop="deleteMessage(msg.id)"
              class="absolute top-1 right-1 text-red-400 hover:text-red-300 rounded-full bg-gray-800"
              style="width: 24px; height: 24px; line-height: 24px; font-size: 16px;"
            >
              <i class="pi pi-times"></i>
            </button>
            <span class="font-semibold text-white">{{ getDisplayName(msg) }}:</span>
            <span class="text-white message-content">
              {{ msg.data.isStreaming && !msg.data.text ? 'AI is responding...' : msg.data.text }}
            </span>
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
            placeholder="Type a message... (@agentName to trigger)"
            :disabled="!currentBreakoutId"
          ></textarea>
        </div>
      </div>
    </div>
  `,
  setup() {
    const {
      breakouts,
      collabs,
      draftMessages,
      draftInitialTimestamps,
      currentBreakoutId,
      sendMessage,
      updateDraft,
      deleteMessage,
      addBreakout,
      updateBreakout,
      deleteBreakout,
      activeUsers,
    } = useCollaboration();
    const { userUuid: currentUserUuid } = useRealTime();
    const { agents } = useAgents();
    const draft = Vue.ref('');
    const chatContainer = Vue.ref(null);
    const isAutoScrollEnabled = Vue.ref(true);
    const editing = Vue.ref({});

    const currentBreakout = Vue.computed(() => breakouts.value.find(r => r.id === currentBreakoutId.value));
    const allMessages = Vue.computed(() => {
      console.log('Computing allMessages, currentBreakoutId:', currentBreakoutId.value, 'collabs:', collabs.value, 'draftMessages:', draftMessages.value);
      if (!currentBreakoutId.value) return [];
      const roomMessages = collabs.value.filter(msg => msg.data.breakoutId === currentBreakoutId.value);
      const drafts = draftMessages.value[currentBreakoutId.value] || {};
      const messages = [
        ...roomMessages.map(msg => ({ ...msg, isDraft: false })),
        ...Object.values(drafts).map(msg => ({ ...msg, isDraft: true })),
      ].sort((a, b) => a.timestamp - b.timestamp);
      console.log('Computed allMessages:', messages);
      return messages;
    });

    function getDisplayName(msg) {
      if (msg.data.agentId) {
        const agent = agents.value.find(a => a.id === msg.data.agentId);
        return agent ? agent.data.name : 'Unknown Agent';
      } else {
        const user = activeUsers.value.find(user => user.userUuid === msg.userUuid);
        const baseName = user?.displayName || (msg.userUuid === currentUserUuid.value ? 'You' : 'Unknown');
        return msg.isDraft && msg.displayNameSuffix ? `${baseName} ${msg.displayNameSuffix}` : baseName;
      }
    }

    function formatTime(timestamp) {
      return timestamp ? new Date(timestamp).toLocaleTimeString() : 'Invalid Date';
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

    Vue.watch(currentBreakoutId, (newId) => {
      if (newId && chatContainer.value) {
        Vue.nextTick(() => {
          chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        });
      }
    });

    function updateDraftLocally(event) {
      const text = event.target.value || '';
      if (currentBreakoutId.value) {
        updateDraft(text, currentBreakoutId.value);
        draft.value = text;
      }
    }

    function handleEnterKey(event) {
      if (event.key === 'Enter' && !event.shiftKey && currentBreakoutId.value) {
        event.preventDefault();
        sendFinalMessage();
      }
    }

    function sendFinalMessage() {
      if (draft.value.trim() && currentBreakoutId.value) {
        sendMessage(draft.value, currentBreakoutId.value);
        draft.value = '';
      } else {
        console.warn('Cannot send message: draft or currentBreakoutId missing', { draft: draft.value, currentBreakoutId: currentBreakoutId.value });
      }
    }

    function selectBreakout(breakoutId) {
      console.log('Selecting breakout with id:', breakoutId);
      currentBreakoutId.value = breakoutId;
    }

    function addBreakoutLocal() {
      const name = `Breakout ${breakouts.value.length + 1}`;
      addBreakout(name);
    }

    function updateBreakoutName(breakoutId) {
      const edited = editing.value[breakoutId];
      if (edited && edited.name.trim()) {
        updateBreakout(breakoutId, edited.name.trim());
        console.log('Emitted update-breakout on input:', { id: breakoutId, name: edited.name.trim() });
      }
    }

    function saveBreakoutName(breakoutId) {
      const edited = editing.value[breakoutId];
      if (edited && edited.name.trim()) {
        updateBreakout(breakoutId, edited.name.trim());
        console.log('Emitted update-breakout on save:', { id: breakoutId, name: edited.name.trim() });
      }
      delete editing.value[breakoutId];
      editing.value = { ...editing.value };
    }

    function deleteMessageLocal(id) {
      if (currentBreakoutId.value) deleteMessage(id, currentBreakoutId.value);
    }

    function deleteBreakoutLocal(id) {
      console.log('Deleting breakout with id:', id);
      deleteBreakout(id);
    }

    function toggleEdit(breakoutId) {
      const breakout = breakouts.value.find(b => b.id === breakoutId);
      if (!breakout) return;
      if (editing.value[breakoutId]) {
        delete editing.value[breakoutId];
      } else {
        editing.value[breakoutId] = { name: breakout.data.name };
      }
      editing.value = { ...editing.value };
    }

    // if (!breakouts.value.length) {
    //   addBreakout();
    // }

    return {
      breakouts,
      allMessages,
      draft,
      currentBreakoutId,
      currentBreakout,
      sendFinalMessage,
      updateDraft: updateDraftLocally,
      handleEnterKey,
      deleteMessage: deleteMessageLocal,
      addBreakout,
      deleteBreakout: deleteBreakoutLocal,
      selectBreakout,
      toggleEdit,
      updateBreakoutName,
      saveBreakoutName,
      editing,
      activeUsers,
      formatTime,
      getDisplayName,
      chatContainer,
      handleScroll,
      currentUserUuid,
      addBreakoutLocal
    };
  },
};