// LLMInteraction.js
import { useLLM } from '../composables/useLLM.js';

export default {
  name: 'LLMInteraction',
  props: {
    updateTab: {
      type: Function,
      required: true,
    },
  },
  template: `
    <div class="flex flex-col min-h-screen p-4 text-white">
      <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
        <i class="pi pi-robot text-blue-400"></i>
        LLM Interaction
      </h2>

      <!-- Form Section -->
      <div class="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
        <form @submit.prevent="triggerLLMRequest" class="grid grid-cols-1 gap-4">
          <div class="flex flex-col">
            <label class="text-sm font-semibold mb-1">Model Provider</label>
            <select v-model="form.model.provider" class="p-2 rounded bg-gray-700 text-white border border-gray-600">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="azureai">AzureAI</option>
              <option value="mistral">Mistral</option>
              <option value="groq">Groq</option>
              <option value="gemini">Gemini</option>
              <option value="xai">xAI</option>
            </select>
          </div>

          <div class="flex flex-col">
            <label class="text-sm font-semibold mb-1">Model Name</label>
            <input v-model="form.model.model" type="text" class="p-2 rounded bg-gray-700 text-white border border-gray-600" placeholder="e.g., gpt-3.5-turbo" required />
          </div>

          <div class="flex flex-col">
            <label class="text-sm font-semibold mb-1">Temperature (0-1)</label>
            <input v-model.number="form.temperature" type="number" step="0.1" min="0" max="1" class="p-2 rounded bg-gray-700 text-white border border-gray-600" required />
          </div>

          <div class="flex flex-col">
            <label class="text-sm font-semibold mb-1">System Prompt</label>
            <textarea v-model="form.systemPrompt" class="p-2 rounded bg-gray-700 text-white border border-gray-600" rows="3" placeholder="e.g., You are a helpful assistant." required></textarea>
          </div>

          <div class="flex flex-col">
            <label class="text-sm font-semibold mb-1">User Prompt</label>
            <textarea v-model="form.userPrompt" class="p-2 rounded bg-gray-700 text-white border border-gray-600" rows="3" placeholder="e.g., What is the weather today?" required></textarea>
          </div>

          <div class="flex items-center gap-2">
            <input v-model="form.useJson" type="checkbox" id="useJson" class="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded" />
            <label for="useJson" class="text-sm font-semibold">Use JSON Response</label>
          </div>

          <button type="submit" class="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            Trigger LLM
          </button>
        </form>
      </div>

      <!-- Response Section -->
      <div class="bg-gray-800 p-6 rounded-lg shadow-lg flex-1 min-h-[500px] overflow-y-auto flex flex-col">
        <h3 class="text-md font-semibold mb-3 flex items-center gap-2">
          <i class="pi pi-comment text-teal-400"></i>
          Responses
        </h3>

        <div class="flex-1 flex flex-col-reverse gap-4">
          <div v-for="(request, id) in sortedRequests" :key="id" class="border border-gray-600 rounded p-4">
            <div v-if="request.isStreaming" class="bg-gray-700">
              <p class="text-gray-300 font-semibold">Streaming (ID: {{ id }}) - {{ request.status }}:</p>
              <pre class="text-white whitespace-pre-wrap">{{ request.llmResponse }}</pre>
            </div>

            <div v-else-if="request.llmResponse && request.status === 'completed'" class="bg-gray-600">
              <p class="text-gray-300 font-semibold">Completed (ID: {{ id }}) - {{ request.status }}:</p>
              <pre class="text-white whitespace-pre-wrap">{{ request.llmResponse }}</pre>
            </div>

            <div v-if="request.llmError" class="bg-red-900 text-red-200">
              <p class="font-semibold">Error (ID: {{ id }}) - {{ request.status }}:</p>
              <p>{{ request.llmError }}</p>
            </div>
          </div>
        </div>

        <p v-if="!Object.keys(llmRequests).length" class="text-gray-400 mt-4">No LLM requests yet. Submit a prompt to get started.</p>
      </div>
    </div>
  `,
  setup(props) {
    const { llmRequests, triggerLLM, cleanup } = useLLM();

    const form = Vue.ref({
      model: {
        provider: 'openai',
        name: 'gpt-3.5-turbo',
        model: 'gpt-3.5-turbo',
      },
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: '',
      useJson: false,
    });

    const messageHistory = Vue.ref([]);

    // Sort requests by ID (newest first, assuming IDs are UUIDs with timestamps)
    const sortedRequests = Vue.computed(() => {
      const requests = { ...llmRequests.value };
      return Object.fromEntries(
        Object.entries(requests).sort((a, b) => b[0].localeCompare(a[0]))
      );
    });

    function triggerLLMRequest() {
      const id = uuidv4(); // Assumes uuidv4 is available globally
      triggerLLM(
        id,
        form.value.model,
        form.value.temperature,
        form.value.systemPrompt,
        form.value.userPrompt,
        messageHistory.value,
        form.value.useJson
      );
    }

    Vue.onUnmounted(() => {
      cleanup();
    });

    return {
      form,
      llmRequests,
      sortedRequests,
      triggerLLMRequest,
    };
  },
};