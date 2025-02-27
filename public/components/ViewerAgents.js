// components/ViewerAgents.js
import { useAgents } from '../composables/useAgents.js';
import { useRealTime } from '../composables/useRealTime.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useGoals } from '../composables/useGoals.js';
import { useClips } from '../composables/useClips.js';

export default {
  name: 'ViewerAgents',
  template: `
    <div class="h-full flex flex-col overflow-hidden p-4">
      <!-- Filter and Add Agent Buttons -->
      <div class="mb-4 flex gap-2">
<!--        <button @click="clearFilter" class="py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Clear</button> -->
        <input
          v-model="filterQuery"
          @input="filterAgents"
          type="text"
          class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          placeholder="Filter agents by name, description, or creator..."
        />
        <button @click="openEditModal()" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">Add</button>
      </div>

      <!-- Agents Grid (Scrollable) -->
      <div class="flex-1 overflow-y-auto space-y-4" ref="agentsContainer">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="agent in filteredAgents"
            :key="agent.id"  
            class="p-4 bg-gray-700 rounded-lg flex flex-col items-center cursor-pointer hover:bg-gray-600 transition-colors"
            @click="openEditModal(agent)"
          >
            <img :src="agent.imageUrl || defaultImage" :alt="agent.name" class="w-16 h-16 rounded-full mb-2 object-cover" />
            <h3 class="text-purple-400 font-semibold">{{ agent.name }}</h3>
            <div class="flex gap-2 mt-2">
              <button @click.stop="openEditModal(agent)" class="py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                Edit
              </button>
              <button @click.stop="confirmDelete(agent.id)" class="py-1 px-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                Delete
              </button>
            </div>
          </div>
        </div>
        <div v-if="filteredAgents.length === 0" class="text-gray-400">No agents found.</div>
      </div>

      <!-- Main Edit Modal -->
      <div v-if="isModalOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
          <h2 class="text-lg font-semibold text-purple-400 mb-4">{{ editingAgent ? 'Edit Agent' : 'Add Agent' }}</h2>
          <div class="space-y-4">
            <input
              v-model="agentName"
              @input="validateName"
              type="text"
              class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              placeholder="Agent name (letters, numbers, underscores only, no spaces)"
              :class="{ 'border-red-500': nameError }"
            />
            <span v-if="nameError" class="text-red-500 text-sm">{{ nameError }}</span>
            <textarea
              v-model="agentDescription"
              class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none h-24"
              placeholder="Description..."
            ></textarea>
            <input
              v-model="agentImageUrl"
              type="text"
              class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              placeholder="Image URL for avatar..."
            />
            <div>
              <h3 class="text-gray-300 mb-2">System Prompts</h3>
              <table class="w-full text-left">
                <thead>
                  <tr class="border-b border-gray-600">
                    <th class="py-2 px-4 text-gray-300">Type</th>
                    <th class="py-2 px-4 text-gray-300">Content</th>
                    <th class="py-2 px-4 text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(prompt, index) in systemPrompts" :key="prompt.id" class="border-b border-gray-600">
                    <td class="py-2 px-4">
                      <select v-model="prompt.type" @change="updatePromptType('system', index, prompt.type)" class="bg-gray-700 text-white rounded-lg p-1">
                        <option value="text">Text</option>
                        <option value="goal">Goal</option>
                        <option value="document">Document</option>
                        <option value="clip">Clip</option>
                      </select>
                    </td>
                    <td class="py-2 px-4">
                      <template v-if="prompt.type === 'text'">
                        <button @click="openPromptModal('system', index, prompt.content)" class="py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                          Edit
                        </button>
                      </template>
                      <template v-else-if="prompt.type === 'goal'">
                        <select v-model="prompt.content" class="bg-gray-700 text-white rounded-lg p-1 w-full">
                          <option v-for="goal in goals" :key="goal.id" :value="goal.id">{{ goal.text.substring(0, 100) }}...</option>
                        </select>
                      </template>
                      <template v-else-if="prompt.type === 'document'">
                        <select v-model="prompt.content" class="bg-gray-700 text-white rounded-lg p-1 w-full">
                          <option v-for="doc in documents" :key="doc.id" :value="doc.id">{{ doc.name }}</option>
                        </select>
                      </template>
                      <template v-else-if="prompt.type === 'clip'">
                        <select v-model="prompt.content" class="bg-gray-700 text-white rounded-lg p-1 w-full">
                          <option v-for="clip in clips" :key="clip.id" :value="clip.id">{{ clip.text.substring(0, 100) }}...</option>
                        </select>
                      </template>
                    </td>
                    <td class="py-2 px-4">
                      <button @click="removePrompt('system', index)" class="text-red-400 hover:text-red-300">
                        <i class="pi pi-times"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <button @click="addPrompt('system')" class="mt-2 py-1 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
                Add System Prompt
              </button>
            </div>
            <div>
              <h3 class="text-gray-300 mb-2">User Prompts</h3>
              <table class="w-full text-left">
                <thead>
                  <tr class="border-b border-gray-600">
                    <th class="py-2 px-4 text-gray-300">Type</th>
                    <th class="py-2 px-4 text-gray-300">Content</th>
                    <th class="py-2 px-4 text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(prompt, index) in userPrompts" :key="prompt.id" class="border-b border-gray-600">
                    <td class="py-2 px-4">
                      <select v-model="prompt.type" @change="updatePromptType('user', index, prompt.type)" class="bg-gray-700 text-white rounded-lg p-1">
                        <option value="text">Text</option>
                        <option value="goal">Goal</option>
                        <option value="document">Document</option>
                        <option value="clip">Clip</option>
                      </select>
                    </td>
                    <td class="py-2 px-4">
                      <template v-if="prompt.type === 'text'">
                        <button @click="openPromptModal('user', index, prompt.content)" class="py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                          Edit
                        </button>
                      </template>
                      <template v-else-if="prompt.type === 'goal'">
                        <select v-model="prompt.content" class="bg-gray-700 text-white rounded-lg p-1 w-full">
                          <option v-for="goal in goals" :key="goal.id" :value="goal.id">{{ goal.text.substring(0, 100) }}...</option>
                        </select>
                      </template>
                      <template v-else-if="prompt.type === 'document'">
                        <select v-model="prompt.content" class="bg-gray-700 text-white rounded-lg p-1 w-full">
                          <option v-for="doc in documents" :key="doc.id" :value="doc.id">{{ doc.name }}</option>
                        </select>
                      </template>
                      <template v-else-if="prompt.type === 'clip'">
                        <select v-model="prompt.content" class="bg-gray-700 text-white rounded-lg p-1 w-full">
                          <option v-for="clip in clips" :key="clip.id" :value="clip.id">{{ clip.text.substring(0, 100) }}...</option>
                        </select>
                      </template>
                    </td>
                    <td class="py-2 px-4">
                      <button @click="removePrompt('user', index)" class="text-red-400 hover:text-red-300">
                        <i class="pi pi-times"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <button @click="addPrompt('user')" class="mt-2 py-1 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
                Add User Prompt
              </button>
            </div>
          </div>
          <div class="mt-4 flex gap-2 justify-end">
            <button @click="closeModal" class="py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancel</button>
            <button @click="saveAgent" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">Save</button>
          </div>
        </div>
      </div>

      <!-- Prompt Editing Modal -->
      <div v-if="isPromptModalOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
          <h2 class="text-lg font-semibold text-purple-400 mb-4">Edit Prompt</h2>
          <textarea
            v-model="promptContent"
            class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none h-64"
            placeholder="Enter prompt text..."
          ></textarea>
          <div class="mt-4 flex gap-2 justify-end">
            <button @click="closePromptModal" class="py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancel</button>
            <button @click="savePrompt" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">Save</button>
          </div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const { agents, addAgent, updateAgent, removeAgent } = useAgents();
    const { displayName } = useRealTime();
    const { documents } = useDocuments();
    const { goals } = useGoals();
    const { clips } = useClips();
    const filterQuery = Vue.ref('');
    const isModalOpen = Vue.ref(false);
    const isPromptModalOpen = Vue.ref(false);
    const editingAgent = Vue.ref(null);
    const agentId = Vue.ref(''); // Changed from agentUuid to agentId
    const agentName = Vue.ref('');
    const agentDescription = Vue.ref('');
    const agentImageUrl = Vue.ref('');
    const systemPrompts = Vue.ref([]);
    const userPrompts = Vue.ref([]);
    const nameError = Vue.ref('');
    const promptType = Vue.ref('');
    const promptIndex = Vue.ref(null);
    const promptContent = Vue.ref('');
    const defaultImage = Vue.computed(() => '../assets/aiagent.png');

    const filteredAgents = Vue.computed(() => {
      if (!filterQuery.value) return agents.value;
      const query = filterQuery.value.toLowerCase();
      return agents.value.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.createdBy.toLowerCase().includes(query)
      );
    });

    function validateName() {
      if (!/^[a-zA-Z0-9_]+$/.test(agentName.value)) {
        nameError.value = 'Agent name must contain only letters, numbers, or underscores, with no spaces.';
      } else {
        nameError.value = '';
      }
    }

    function filterAgents() {
      // Handled by filteredAgents computed property
    }

    function clearFilter() {
      filterQuery.value = '';
    }

    function openEditModal(agent = null) {
      if (agent) {
        editingAgent.value = agent;
        agentId.value = agent.id; // Changed from uuid to id
        agentName.value = agent.name;
        agentDescription.value = agent.description;
        agentImageUrl.value = agent.imageUrl;
        systemPrompts.value = [...agent.systemPrompts];
        userPrompts.value = [...agent.userPrompts];
      } else {
        editingAgent.value = null;
        agentId.value = uuidv4(); // Still using uuidv4() for unique IDs
        agentName.value = '';
        agentDescription.value = '';
        agentImageUrl.value = '';
        systemPrompts.value = [];
        userPrompts.value = [];
      }
      isModalOpen.value = true;
      validateName();
    }

    function closeModal() {
      isModalOpen.value = false;
      editingAgent.value = null;
    }

    function addPrompt(type) {
      const prompts = type === 'system' ? systemPrompts : userPrompts;
      prompts.value.push({ id: uuidv4(), type: 'text', content: '' });
    }

    function removePrompt(type, index) {
      const prompts = type === 'system' ? systemPrompts : userPrompts;
      prompts.value.splice(index, 1);
    }

    function updatePromptType(type, index, newType) {
      const prompts = type === 'system' ? systemPrompts : userPrompts;
      prompts.value[index].type = newType;
      if (newType !== 'text') prompts.value[index].content = '';
    }

    function openPromptModal(type, index, content) {
      promptType.value = type;
      promptIndex.value = index;
      promptContent.value = content || '';
      isPromptModalOpen.value = true;
    }

    function closePromptModal() {
      isPromptModalOpen.value = false;
      promptType.value = '';
      promptIndex.value = null;
      promptContent.value = '';
    }

    function savePrompt() {
      if (promptType.value && promptIndex.value !== null) {
        const prompts = promptType.value === 'system' ? systemPrompts : userPrompts;
        prompts.value[promptIndex.value] = { ...prompts.value[promptIndex.value], content: promptContent.value };
      }
      closePromptModal();
    }

    function saveAgent() {
      if (nameError.value) return;
      if (editingAgent.value) {
        updateAgent(agentId.value, agentName.value, agentDescription.value, agentImageUrl.value, systemPrompts.value, userPrompts.value);
      } else {
        addAgent(agentName.value, agentDescription.value, agentImageUrl.value, systemPrompts.value, userPrompts.value);
      }
      closeModal();
    }

    function confirmDelete(id) { // Changed from uuid to id
      if (confirm('Are you sure you want to delete this agent?')) {
        removeAgent(id);
      }
    }

    Vue.onUnmounted(() => {
      // Cleanup handled by useAgents
    });

    return {
      agents,
      documents,
      goals,
      clips,
      filterQuery,
      filteredAgents,
      isModalOpen,
      isPromptModalOpen,
      editingAgent,
      agentId, // Changed from agentUuid to agentId
      agentName,
      agentDescription,
      agentImageUrl,
      systemPrompts,
      userPrompts,
      nameError,
      promptType,
      promptIndex,
      promptContent,
      defaultImage,
      filterAgents,
      clearFilter,
      openEditModal,
      closeModal,
      addPrompt,
      removePrompt,
      updatePromptType,
      openPromptModal,
      closePromptModal,
      savePrompt,
      saveAgent,
      confirmDelete,
      validateName,
    };
  },
};