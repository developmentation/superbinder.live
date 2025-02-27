// components/ViewerGoals.js
import { useGoals } from '../composables/useGoals.js';

export default {
  name: 'ViewerGoals',
  template: `
    <div class="h-full flex flex-col overflow-hidden p-4">
      <div class="flex gap-2 mb-4">
        <input
          v-model="newGoal"
          @keypress.enter.prevent="debounceAddGoal"
          class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          placeholder="Add a new goal..."
        />
        <button @click.prevent="debounceAddGoal" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg">Add</button>
      </div>
      <div class="space-y-2 relative" ref="goalsContainer">
        <!-- Reorder Indicator Line -->
        <div
          v-if="dragIndicator"
          :style="{ top: dragIndicator.y + 'px', left: '8px', width: 'calc(100% - 16px)', height: '2px', backgroundColor: '#3B82F6', position: 'absolute', zIndex: 10 }"
          class="transition-all duration-200"
        ></div>
        <div
          v-else
          class="invisible"
        ></div>
        <div
          v-for="(goal, index) in goals"
          :key="goal.id"
          class="p-2 bg-gray-700 rounded-lg flex items-center gap-2 min-w-0 cursor-move transition-transform duration-300"
          :class="{ 'dragging': isDragging && draggedIndex === index, 'unselectable': isDragging }"
          @mousedown="startDrag(index, $event)"
          @touchstart="startDrag(index, $event)"
        >
          <span class="text-gray-400 mr-2" :class="{ 'unselectable': isDragging }">⋮⋮</span>
          <div
            contenteditable="true"
            @input="handleGoalInput(goal.id, $event)"
            class="flex-1 text-white min-w-0 break-words"
            :class="{ 'bg-gray-600': editingGoal === goal.id }"
            @focus="editingGoal = goal.id"
            @blur="editingGoal = null"
            @mousedown.stop="preventDefaultIfDragging"
            @touchstart.stop="preventDefaultIfDragging"
          >
            {{ goal.text }}
          </div>
          <button @click.stop="removeGoal(goal.id)" class="text-red-400 hover:text-red-300 ml-2">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
      <div v-if="goals.length === 0" class="text-gray-400">No goals yet.</div>
    </div>
  `,
  setup() {
    const { goals, addGoal, updateGoal, removeGoal, reorderGoals, cleanup } = useGoals();
    const newGoal = Vue.ref('');
    const editingGoal = Vue.ref(null);
    const isDragging = Vue.ref(false);
    const draggedIndex = Vue.ref(null);
    const goalsContainer = Vue.ref(null);
    const dragIndicator = Vue.ref(null);
    let debounceTimer = null;

    function debounceAddGoal() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        if (newGoal.value && newGoal.value.trim()) {
          addGoal(newGoal.value.trim());
          newGoal.value = '';
        }
        debounceTimer = null;
      }, 300); // 300ms debounce to prevent multiple rapid triggers
    }

    function handleGoalInput(id, event) {
      const newText = event.target.textContent.trim();
      if (newText) {
        updateGoal(id, newText);
      } else {
        // If text is empty, remove the goal
        removeGoal(id);
      }
    }

    function startDrag(index, event) {
      event.preventDefault();
      isDragging.value = true;
      draggedIndex.value = index;
      const goalElement = event.target.closest('.p-2');
      const container = goalsContainer.value;
      let lastY = 0;

      if (event.type === 'mousedown') {
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
      } else if (event.type === 'touchstart') {
        document.addEventListener('touchmove', handleDrag);
        document.addEventListener('touchend', stopDrag);
      }

      function handleDrag(e) {
        e.preventDefault();
        const y = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        const rect = container.getBoundingClientRect();
        const goalHeight = goalElement.offsetHeight;
        const offsetY = y - rect.top;
        const newIndex = Math.max(0, Math.min(goals.value.length - 1, Math.floor(offsetY / (goalHeight + 8))));

        requestAnimationFrame(() => {
          if (Math.abs(y - lastY) > 5) {
            if (newIndex !== index) {
              reorderGoals(goals.value[index].id, newIndex);
              draggedIndex.value = newIndex;
              index = newIndex;
            }
            dragIndicator.value = { y: newIndex * (goalHeight + 8) + 4 };
            lastY = y;
          }
        });
      }

      function stopDrag() {
        isDragging.value = false;
        draggedIndex.value = null;
        dragIndicator.value = null;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', handleDrag);
        document.removeEventListener('touchend', stopDrag);
      }
    }

    function preventDefaultIfDragging(event) {
      if (isDragging.value) {
        event.preventDefault();
      }
    }

    Vue.onUnmounted(() => {
        cleanup();
      });


    return { goals, newGoal, editingGoal, debounceAddGoal, handleGoalInput, removeGoal, startDrag, isDragging, draggedIndex, goalsContainer, dragIndicator, preventDefaultIfDragging };
  },
};