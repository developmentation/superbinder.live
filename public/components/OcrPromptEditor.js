// components/OcrPromptEditor.js
import { usePrompts } from '../composables/usePrompts.js'; // Import usePrompts

export default {
  name: 'OcrPromptEditor',
  props: {
    initialPrompt: {
      type: String,
      required: true,
    },
  },
  emits: ['update-prompt', 'close', 'reset-prompt'],
  setup(props, { emit }) {
    const prompt = Vue.ref(props.initialPrompt);
    const { prompts, cleanup } = usePrompts(); // Use the prompts composable

    // Save the current prompt and close the modal
    const savePrompt = () => {
      emit('update-prompt', prompt.value);
      emit('close');
    };

    // Cancel and close the modal without saving
    const cancel = () => {
      emit('close');
    };

    // Reset to default prompt
    const resetToDefault = () => {
      console.log("resetToDefault in OcrPromptEditor");
      emit('reset-prompt');
    };

    // Handle prompt selection from dropdown
    const selectPrompt = (event) => {
      const selectedId = event.target.value;
      if (selectedId === '') return; // Ignore the default "Select a prompt" option
      const selectedPrompt = prompts.value.find(p => p.id === selectedId);
      if (selectedPrompt) {
        prompt.value = selectedPrompt.data.text || ''; // Replace with selected prompt's text
      }
    };

    // Watch for changes to initialPrompt prop
    Vue.watch(() => props.initialPrompt, (newValue) => {
      console.log('Initial prompt changed:', newValue);
      prompt.value = newValue;
    });

    // Cleanup event listeners when component is unmounted
    Vue.onUnmounted(() => {
      cleanup();
    });

    return {
      prompt,
      prompts, // Expose prompts for the dropdown
      savePrompt,
      cancel,
      resetToDefault,
      selectPrompt,
    };
  },
  template: `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
      <div class="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h2 class="text-2xl font-bold text-white mb-4">Edit OCR Prompt</h2>
        <select
          @change="selectPrompt"
          class="w-full p-2 mb-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          <option value="">Select a prompt</option>
          <option v-for="p in prompts" :key="p.id" :value="p.id">{{ p.data.name }}</option>
        </select>
        <textarea
          v-model="prompt"
          class="w-full h-64 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="Enter your OCR prompt here..."
        ></textarea>
        <div class="flex gap-4 mt-6">
          <button
            @click="savePrompt"
            class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Save
          </button>
          <button
            @click="resetToDefault"
            class="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors"
          >
            Reset to Default
          </button>
          <button
            @click="cancel"
            class="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
};