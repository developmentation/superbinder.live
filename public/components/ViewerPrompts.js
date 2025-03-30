// components/ViewerPrompts.js
import { usePrompts } from '../composables/usePrompts.js';

export default {
  name: 'ViewerPrompts',
  setup() {
    const { prompts, addPrompt, updatePrompt, removePrompt } = usePrompts();
    const selectedPrompt = Vue.ref(null);
    const isEditing = Vue.ref(false);
    const editedName = Vue.ref('');
    const editedDescription = Vue.ref('');
    const editedText = Vue.ref('');
    const filterText = Vue.ref('');
    const md = markdownit({ html: true, linkify: true, typographer: true, breaks: true });

    const filteredPrompts = Vue.computed(() => {
      if (!filterText.value.trim()) return prompts.value;
      const lowerFilter = filterText.value.toLowerCase();
      return prompts.value.filter(p => 
        p.data.name.toLowerCase().includes(lowerFilter) || 
        p.data.description.toLowerCase().includes(lowerFilter)
      );
    });

    const renderedPrompt = Vue.computed(() => {
      if (!selectedPrompt.value) return '';
      return md.render(selectedPrompt.value.data.text || '');
    });

    const selectPrompt = (prompt) => {
      selectedPrompt.value = prompt;
      isEditing.value = false;
      editedName.value = '';
      editedDescription.value = '';
      editedText.value = '';
    };

    const startEditing = () => {
      if (!selectedPrompt.value) return;
      isEditing.value = true;
      editedName.value = selectedPrompt.value.data.name;
      editedDescription.value = selectedPrompt.value.data.description || '';
      editedText.value = selectedPrompt.value.data.text;
    };

    const finishEditing = () => {
      if (!selectedPrompt.value) return;
      updatePrompt(
        selectedPrompt.value.id,
        editedName.value,
        editedDescription.value,
        editedText.value
      );
      selectedPrompt.value.data.name = editedName.value;
      selectedPrompt.value.data.description = editedDescription.value;
      selectedPrompt.value.data.text = editedText.value;
      isEditing.value = false;
    };

    const addNewPrompt = () => {
      const name = 'New Prompt';
      addPrompt(name, '', '');
      const newPrompt = prompts.value.find(p => p.data.name === name && p.data.text === '');
      if (newPrompt) selectPrompt(newPrompt);
    };

    const deletePrompt = () => {
      if (!selectedPrompt.value) return;
      removePrompt(selectedPrompt.value.id);
      selectedPrompt.value = null;
      isEditing.value = false;
    };

    return {
      prompts,
      selectedPrompt,
      isEditing,
      editedName,
      editedDescription,
      editedText,
      filterText,
      filteredPrompts,
      renderedPrompt,
      selectPrompt,
      startEditing,
      finishEditing,
      addNewPrompt,
      deletePrompt,
    };
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden bg-[#1a2233]">
      <div class="flex flex-col md:flex-row h-full">
        <!-- Left Column: Prompt List -->
        <div class="w-full md:w-1/3 border-r border-[#2d3748] overflow-hidden flex flex-col">
          <div class="p-2 bg-[#1a2233] border-b border-[#2d3748] sticky top-0 z-10 flex items-center gap-2">
            <input
              v-model="filterText"
              placeholder="Filter prompts..."
              class="w-full p-1 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] text-sm"
            />
            <button
              @click="addNewPrompt"
              class="py-1 px-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-sm flex items-center"
              title="Add New Prompt"
            >
              <i class="pi pi-plus"></i>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto">
            <div
              v-for="prompt in filteredPrompts"
              :key="prompt.id"
              @click="selectPrompt(prompt)"
              class="p-2 border-b border-[#2d3748] text-[#e2e8f0] cursor-pointer hover:bg-[#2d3748] flex items-center justify-between"
              :class="{ 'bg-[#3b82f6]': selectedPrompt && selectedPrompt.id === prompt.id }"
            >
              <span class="text-sm truncate">{{ prompt.data.name }}</span>
              <button
                @click.stop="removePrompt(prompt.id)"
                class="text-[#ef4444] hover:text-[#dc2626] text-sm"
                title="Delete Prompt"
              >
                <i class="pi pi-trash"></i>
              </button>
            </div>
            <div v-if="!filteredPrompts.length" class="p-4 text-[#94a3b8] text-sm text-center">
              No prompts found.
            </div>
          </div>
        </div>

        <!-- Right Column: Prompt Viewer/Editor -->
        <div class="w-full md:w-2/3 overflow-hidden flex flex-col">
          <div v-if="selectedPrompt" class="p-2 bg-[#1a2233] border-b border-[#2d3748] sticky top-0 z-10 flex items-center gap-2">
            <button
              v-if="!isEditing"
              @click="startEditing"
              class="p-1 text-[#f59e0b] hover:text-[#d97706]"
              title="Edit Prompt"
            >
              <i class="pi pi-pencil"></i>
            </button>
            <button
              v-if="isEditing"
              @click="finishEditing"
              class="py-1 px-2 bg-[#10b981] text-white rounded-lg text-sm flex items-center"
              title="Save Changes"
            >
              <i class="pi pi-check mr-1"></i> Done
            </button>
            <button
              v-if="!isEditing"
              @click="deletePrompt"
              class="p-1 text-[#ef4444] hover:text-[#dc2626]"
              title="Delete Prompt"
            >
              <i class="pi pi-trash"></i>
            </button>
            <h2 class="flex-1 text-sm font-bold text-gray-500 truncate">{{ selectedPrompt.data.name }}</h2>
          </div>
          <div v-if="selectedPrompt" class="flex-1 overflow-y-auto p-4">
            <div v-if="isEditing" class="space-y-4">
              <div>
                <label class="block text-[#e2e8f0] text-sm mb-1">Name</label>
                <input
                  v-model="editedName"
                  class="w-full p-2 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] text-sm"
                  placeholder="Prompt Name"
                />
              </div>
              <div>
                <label class="block text-[#e2e8f0] text-sm mb-1">Description (Optional)</label>
                <textarea
                  v-model="editedDescription"
                  class="w-full p-2 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] text-sm resize-y"
                  placeholder="Prompt Description"
                  rows="3"
                ></textarea>
              </div>
              <div>
                <label class="block text-[#e2e8f0] text-sm mb-1">Prompt Text</label>
                <textarea
                  v-model="editedText"
                  class="w-full p-2 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] text-sm resize-y"
                  placeholder="Enter your prompt here (Markdown supported)"
                  rows="10"
                ></textarea>
              </div>
            </div>
            <div v-else class="text-[#e2e8f0] whitespace-pre-wrap" v-html="renderedPrompt"></div>
          </div>
          <div v-else class="h-full flex items-center justify-center text-[#94a3b8] text-sm">
            Select a prompt to view or edit.
          </div>
        </div>
      </div>
    </div>
  `,
};