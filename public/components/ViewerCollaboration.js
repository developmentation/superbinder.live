// components/ViewerCollaboration.js
import { useCollaboration } from '../composables/useCollaboration.js';
import { useRealTime } from '../composables/useRealTime.js';
import { useAgents } from '../composables/useAgents.js';

export default {
  name: 'ViewerCollaboration',
  template: `
    <div class="flex flex-col md:flex-row overflow-hidden bg-gray-900" style="height: calc(100% - 50px);">
      <!-- Toggle Button for Mobile -->
      <button
        @click="toggleSidebar"
        class="md:hidden fixed top-2 left-2 z-20 p-2 bg-purple-600 text-white rounded-lg"
      >
        <i :class="sidebarVisible ? 'pi pi-times' : 'pi pi-bars'"></i>
      </button>

      <!-- Sidebar -->
      <div
        :class="{
          'w-72 bg-gray-800 flex-shrink-0 border-r border-gray-700 flex flex-col shadow-lg': true,
          'fixed inset-y-0 left-0 z-10 transform transition-transform duration-300': true,
          'translate-x-0': sidebarVisible,
          '-translate-x-full': !sidebarVisible,
          'md:static md:translate-x-0': true
        }"
      >
        <!-- Breakout Rooms -->
        <div class="flex flex-col flex-1">
          <div class="p-1 border-b border-gray-700 flex justify-between items-center">
            <h3 class="text-lg font-semibold text-purple-400">Breakout Rooms</h3>
            <button @click="addBreakoutLocal" class="text-white hover:text-green-400 transition-colors">
              <i class="pi pi-plus"></i>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto custom-scrollbar max-h-[300px]">
            <div
              v-for="breakout in breakouts"
              :key="breakout.id"
              @click="selectBreakout(breakout.id)"
              class="p-3 mx-2 my-1 cursor-pointer hover:bg-gray-700 rounded-lg flex justify-between items-center transition-colors"
              :class="{ 'bg-gray-700': currentBreakoutId === breakout.id }"
            >
              <div class="flex items-center flex-1">
                <span v-if="!editing[breakout.id]" class="text-white text-sm">{{ breakout.data.name }}</span>
                <input
                  v-else
                  v-model="editing[breakout.id].name"
                  @input="updateBreakoutName(breakout.id)"
                  @blur="saveBreakoutName(breakout.id)"
                  @keypress.enter="saveBreakoutName(breakout.id)"
                  class="bg-gray-700 text-white border border-gray-600 rounded p-1 w-full text-sm"
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
            <div v-if="!breakouts.length" class="p-2 text-gray-400 text-sm">No breakout rooms yet.</div>
          </div>
        </div>

        <!-- Agents List -->
        <div class="flex flex-col flex-1">
          <div class="p-4 border-t border-gray-700 flex justify-between items-center">
            <h3 class="text-lg font-semibold text-purple-400">Agents</h3>
          </div>
          <div class="flex-1 overflow-y-auto custom-scrollbar max-h-[300px]">
            <div
              v-for="agent in agents"
              :key="agent.id"
              @click="appendAgentName(agent.data.name)"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <img
                :src="agent.data.imageUrl || \`/assets/aiagent\${agent.data.placeholderImage || 1}.jpg\`"
                alt="Agent Avatar"
                class="w-12 h-12 rounded-full object-cover border border-gray-600"
              />
              <span class="text-white text-sm">{{ agent.data.name }}</span>
            </div>
            <div v-if="!agents.length" class="text-gray-400 text-sm p-2">No agents available.</div>
          </div>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="flex-1 flex flex-col bg-gray-900">
        <!-- Header -->
        <div class="p-1 border-b border-gray-700 flex justify-between items-center flex-shrink-0 bg-gray-800">
          <h3 class="text-xl font-semibold text-purple-400">{{ currentBreakout?.data.name || 'Select a Breakout Room' }}</h3>
          <div class="flex items-center gap-2">
            <span class="text-gray-400 text-sm">Active Users: {{ activeUsers.length }}</span>
          </div>
        </div>

        <!-- Chat Messages -->
        <div ref="chatContainer" class="flex-1 overflow-y-auto p-6 scrollbar-hide" @scroll.passive="handleScroll">
          <div
            v-for="msg in allMessages"
            :key="msg.id"
            class="mb-4 flex items-start gap-3"
          >
            <!-- Avatar -->
            <img
              v-if="msg.data.agentId"
              :src="getAgentAvatar(msg.data.agentId)"
              alt="Agent Avatar"
              class="w-10 h-10 rounded-full object-cover border border-gray-600"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              :style="{ backgroundColor: msg.data.color || '#808080' }"
            >
              {{ getDisplayName(msg).charAt(0).toUpperCase() }}
            </div>

            <!-- Message Content -->
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold text-white">{{ getDisplayName(msg) }}</span>
                <span class="text-gray-400 text-xs">{{ formatTime(msg.timestamp) }}</span>
                <div class="flex gap-1 ml-2">
                  <button
                    v-if="!msg.isDraft"
                    @click.stop="copyMessage(msg.data.text)"
                    class="text-gray-400 hover:text-gray-200 rounded-full bg-gray-700 p-1"
                    title="Copy message"
                  >
                    <i class="pi pi-copy text-sm"></i>
                  </button>
                  <button
                    v-if="!msg.isDraft"
                    @click.stop="redoMessage(msg.data.text)"
                    class="text-gray-400 hover:text-gray-200 rounded-full bg-gray-700 p-1"
                    title="Redo message"
                  >
                    <i class="pi pi-refresh text-sm"></i>
                  </button>
                  <button
                    v-if="!msg.isDraft && msg.id && msg.userUuid === currentUserUuid"
                    @click.stop="deleteMessage(msg.id)"
                    class="text-red-400 hover:text-red-300 rounded-full bg-gray-700 p-1"
                    title="Delete message"
                  >
                    <i class="pi pi-times text-sm"></i>
                  </button>
                </div>
              </div>
              <div
                class="p-3 rounded-lg shadow-md markdown-body"
                :class="{
                  'bg-gray-800': !msg.isDraft && !msg.data.agentId,
                  'bg-blue-900': !msg.isDraft && msg.data.agentId,
                  'bg-gray-600 opacity-75': msg.isDraft,
                }"
              >
                <div
                  class="text-white message-content break-words"
                  v-html="renderMarkdown(msg.data.isStreaming && !msg.data.text ? 'AI is responding...' : msg.data.text)"
                ></div>
              </div>
            </div>
          </div>
          <div v-if="!allMessages.length" class="text-gray-400 text-center">No messages yet.</div>
        </div>

        <!-- Chat Input -->
        <div class="p-4 border-t border-gray-700 flex gap-3 items-center flex-shrink-0 bg-gray-800">
          <textarea
            ref="chatInput"
            v-model="draft"
            @input="updateDraft"
            @keypress.enter="handleEnterKey"
            rows="2"
            class="flex-1 p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none transition-all"
            placeholder="Type a message... (@agentName to trigger)"
            :disabled="!currentBreakoutId"
          ></textarea>
          <button
            @click="sendFinalMessage"
            class="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            :disabled="!draft.trim() || !currentBreakoutId"
          >
            Send
          </button>
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
    const chatInput = Vue.ref(null);
    const isAutoScrollEnabled = Vue.ref(true);
    const editing = Vue.ref({});
    const sidebarVisible = Vue.ref(false); // New state for sidebar visibility

    const currentBreakout = Vue.computed(() => breakouts.value.find(r => r.id === currentBreakoutId.value));
    const allMessages = Vue.computed(() => {
      if (!currentBreakoutId.value) return [];
      const roomMessages = collabs.value.filter(msg => msg.data.breakoutId === currentBreakoutId.value);
      const drafts = draftMessages.value[currentBreakoutId.value] || {};
      const messages = [
        ...roomMessages.map(msg => ({ ...msg, isDraft: false })),
        ...Object.values(drafts).map(msg => ({ ...msg, isDraft: true })),
      ].sort((a, b) => a.timestamp - b.timestamp);
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

    function getAgentAvatar(agentId) {
      const agent = agents.value.find(a => a.id === agentId);
      return agent ? (agent.data.imageUrl || `/assets/aiagent${agent.data.placeholderImage || 1}.jpg`) : '/assets/aiagent1.jpg';
    }

    function formatTime(timestamp) {
      return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Invalid Date';
    }

    function renderMarkdown(content) {
      if (!content) return '';
      try {
        let textContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
        if (textContent.trim().startsWith('{') || textContent.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(textContent);
            textContent = '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
          } catch (e) {
            textContent = '```json\n' + textContent + '\n```';
          }
        }
        const md = markdownit({ html: true, breaks: true, linkify: true, typographer: true });
        return md.render(textContent);
      } catch (error) {
        console.error('Error in renderMarkdown:', error);
        return `<pre class="hljs"><code>${content}</code></pre>`;
      }
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

    function copyMessage(text) {
      if (!text) return;
  
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => {
            console.log('Message copied to clipboard:', text);
            // Optional: Add visual feedback, e.g., a toast notification
          })
          .catch(err => {
            console.error('Clipboard API error:', err);
            fallbackCopy(text);
          });
      } else {
        fallbackCopy(text);
      }
    }
  
    function fallbackCopy(text) {
      const tempInput = document.createElement('input');
      document.body.appendChild(tempInput);
      tempInput.value = text;
      tempInput.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          console.log('Fallback: Message copied to clipboard:', text);
          // Optional: Add visual feedback
        } else {
          console.error('Fallback copy failed: execCommand returned false');
        }
      } catch (err) {
        console.error('Fallback copy failed:', err);
      } finally {
        document.body.removeChild(tempInput);
      }
    }

    function redoMessage(text) {
      if (!text) return;
      draft.value = text;
      if (currentBreakoutId.value) {
        updateDraft(text, currentBreakoutId.value);
      }
      Vue.nextTick(() => {
        if (chatInput.value) {
          chatInput.value.focus();
        }
      });
    }

    function selectBreakout(breakoutId) {
      console.log('Selecting breakout with id:', breakoutId);
      currentBreakoutId.value = breakoutId;
      if (window.innerWidth < 768) sidebarVisible.value = false; // Hide sidebar on mobile after selection
    }

    function appendAgentName(agentName) {
      const currentText = draft.value || '';
      draft.value = currentText + (currentText ? ' ' : '') + `@${agentName} `;
      if (currentBreakoutId.value) {
        updateDraft(draft.value, currentBreakoutId.value);
      }
      Vue.nextTick(() => {
        if (chatInput.value) {
          chatInput.value.focus();
        }
      });
      if (window.innerWidth < 768) sidebarVisible.value = false; // Hide sidebar on mobile after selection
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

    function toggleSidebar() {
      sidebarVisible.value = !sidebarVisible.value;
    }

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
      chatInput,
      handleScroll,
      currentUserUuid,
      addBreakoutLocal,
      copyMessage,
      redoMessage,
      agents,
      getAgentAvatar,
      renderMarkdown,
      appendAgentName,
      sidebarVisible, // Expose sidebar visibility
      toggleSidebar,  // Expose toggle function
    };
  },
};