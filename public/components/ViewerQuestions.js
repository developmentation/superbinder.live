// components/ViewerQuestions.js
import { useQuestions } from '../composables/useQuestions.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useClips } from '../composables/useClips.js';

export default {
  name: 'ViewerQuestions',
  template: `
    <div class="h-full flex flex-col overflow-hidden p-4">
      <div class="flex gap-2 mb-4">
        <input
          v-model="newQuestion"
          @input="startQuestionDraft(newQuestionId, $event.target.value)"
          @blur="stopQuestionDraft(newQuestionId)"
          @keypress.enter="addQuestionLocal"
          class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          placeholder="Ask a question..."
        />
        <button @click="addQuestionLocal" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg">Add</button>
      </div>
      <div ref="questionsContainer" class="space-y-4">
        <div
          v-for="(question, index) in questions"
          :key="question.id"
          class="bg-gray-700 rounded-lg p-4 transition-transform duration-300 question"
          :class="{ 'dragging': isDraggingQuestion && draggedQuestionIndex === index }"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="text-gray-400 cursor-move"
            @mousedown="startDragQuestion(index, $event)"
            @touchstart="startDragQuestion(index, $event)"
          >⋮⋮</span>
            <div
              contenteditable="true"
              @input="updateQuestion(question.id, $event.target.textContent)"
              class="flex-1 text-white break-words"
              :class="{ 'bg-gray-600': drafts[question.id] }"
              @focus="startQuestionDraft(question.id, $event.target.textContent)"
              @blur="stopQuestionDraft(question.id)"
            >
              {{ question.text }}
            </div>
            <button @click.stop="removeQuestion(question.id)" class="text-red-400 hover:text-red-300">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div v-if="drafts[question.id]" class="text-gray-400 text-sm">Someone is typing...</div>
          <div ref="answersContainer" class="space-y-2 ml-4">
            <div
              v-for="(answer, ansIndex) in question.answers"
              :key="answer.id"
              class="p-2 bg-gray-600 rounded-lg flex items-center gap-2 transition-transform duration-300"
              :class="{ 'dragging': isDraggingAnswer && draggedAnswerIndex[question.id] === ansIndex }"
              
            >
              <span class="text-gray-400 cursor-move"
              @mousedown="startDragAnswer(question.id, ansIndex, $event)"
              @touchstart="startDragAnswer(question.id, ansIndex, $event)">⋮⋮</span>
              <div
                contenteditable="true"
                @input="updateAnswer(question.id, answer.id, $event.target.textContent)"
                class="flex-1 text-white break-words"
                :class="{ 'bg-gray-500': drafts[question.id] && drafts[question.id][answer.id] }"
                @focus="startAnswerDraft(question.id, answer.id, $event.target.textContent)"
                @blur="stopAnswerDraft(question.id, answer.id)"
              >
                {{ answer.text }}
              </div>
              <div class="flex gap-2">
                <button @click="voteAnswer(question.id, answer.id, 'up')" class="text-green-400">↑ {{ answer.votes || 0 }}</button>
                <button @click="voteAnswer(question.id, answer.id, 'down')" class="text-red-400">↓</button>
                <button @click.stop="removeAnswer(question.id, answer.id)" class="text-red-400 hover:text-red-300">
                  <i class="pi pi-times"></i>
                </button>
              </div>
              <div v-if="drafts[question.id] && drafts[question.id][answer.id]" class="text-gray-400 text-sm">Someone is typing...</div>
            </div>
          </div>
          <div class="mt-2">
            <input
              v-model="newAnswer[question.id]"
              @input="startAnswerDraft(question.id, newAnswerId[question.id], $event.target.value)"
              @blur="stopAnswerDraft(question.id, newAnswerId[question.id])"
              @keypress.enter="addAnswerLocal(question.id)"
              class="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              placeholder="Add an answer..."
            />
            <button @click="addAnswerLocal(question.id)" class="mt-2 py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg">Add Answer</button>
          </div>
          <div v-if="!question.answers?.length" class="text-gray-400">No answers yet.</div>
        </div>
      </div>
      <div v-if="questions.length === 0" class="text-gray-400">No questions yet.</div>
    </div>
  `,
  setup() {
    const { questions, drafts, addQuestion, updateQuestion, removeQuestion, reorderQuestions, addAnswer, updateAnswer, removeAnswer, reorderAnswers, voteAnswer, startQuestionDraft, stopQuestionDraft, startAnswerDraft, stopAnswerDraft } = useQuestions();
    const { selectedDocument, documents } = useDocuments();
    const { clips } = useClips();
    const newQuestion = Vue.ref('');
    const newQuestionId = Vue.ref(uuidv4());
    const newAnswer = Vue.ref({});
    const newAnswerId = Vue.ref({});
    const isDraggingQuestion = Vue.ref(false);
    const draggedQuestionIndex = Vue.ref(null);
    const questionsContainer = Vue.ref(null); //Implement
    const dragQuestionsIndicator = Vue.ref(null); //Implement
    const isDraggingAnswer = Vue.ref(false);
    const draggedAnswerIndex = Vue.ref({});
    const questionContainer = Vue.ref(null); //Implement
    const dragAnswersIndicator = Vue.ref({}); //Implement
    const answersContainers = Vue.ref({});

    function addQuestionLocal() {
      if (newQuestion.value.trim()) {
        addQuestion(newQuestion.value);
        newQuestion.value = '';
        newQuestionId.value = uuidv4();
      }
    }

    function addAnswerLocal(questionId) {
      if (newAnswer.value[questionId]?.trim()) {
        newAnswerId.value[questionId] = uuidv4();
        addAnswer(questionId, newAnswer.value[questionId]);
        newAnswer.value[questionId] = '';
      }
    }

    function startDragQuestion(index, event) {
      event.preventDefault();
      isDraggingQuestion.value = true;
      draggedQuestionIndex.value = index;
      const questionElement = event.target.closest('.question');
      const container = questionsContainer.value;
      let lastY = 0;

      if (event.type === 'mousedown') {
        document.addEventListener('mousemove', handleDragQuestion);
        document.addEventListener('mouseup', stopDragQuestion);
      } else if (event.type === 'touchstart') {
        document.addEventListener('touchmove', handleDragQuestion);
        document.addEventListener('touchend', stopDragQuestion);
      }

      function handleDragQuestion(e) {
        e.preventDefault();
        const y = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        const rect = container.getBoundingClientRect();
        const questionHeight = questionElement.offsetHeight;
        const offsetY = y - rect.top;
        const newIndex = Math.max(0, Math.min(questions.value.length - 1, Math.floor(offsetY / (questionHeight + 16))));

        // if (newIndex !== index) {
        //   reorderQuestions(questions.value[index].id, newIndex);
        //   draggedQuestionIndex.value = newIndex;
        // }

        requestAnimationFrame(() => {
          if (Math.abs(y - lastY) > 5) {
            if (newIndex !== index) {
              reorderQuestions(questions.value[index].id, newIndex);
              draggedQuestionIndex.value = newIndex;
              index = newIndex;
            }
            console.log(dragQuestionsIndicator.value);

            dragQuestionsIndicator.value = { y: newIndex * (questionHeight) + 4 };
            lastY = y;
          }
        });
      }

      function stopDragQuestion() {
        isDraggingQuestion.value = false;
        draggedQuestionIndex.value = null;
        dragQuestionsIndicator.value = null;
        document.removeEventListener('mousemove', handleDragQuestion);
        document.removeEventListener('mouseup', stopDragQuestion);
        document.removeEventListener('touchmove', handleDragQuestion);
        document.removeEventListener('touchend', stopDragQuestion);
      }
    }

    function startDragAnswer(questionId, index, event) {
      isDraggingAnswer.value = true;
      draggedAnswerIndex.value[questionId] = index;
      const answerElement = event.target.closest('.bg-gray-600');
      const container = answersContainers.value[questionId];

      if (event.type === 'mousedown') {
        document.addEventListener('mousemove', handleDragAnswer);
        document.addEventListener('mouseup', stopDragAnswer);
      } else if (event.type === 'touchstart') {
        document.addEventListener('touchmove', handleDragAnswer);
        document.addEventListener('touchend', stopDragAnswer);
      }

      function handleDragAnswer(e) {
        e.preventDefault();
        const y = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        const rect = container.getBoundingClientRect();
        const offsetY = y - rect.top - answerElement.offsetHeight / 2;
        const newIndex = Math.max(0, Math.min(questions.value.find(q => q.id === questionId).answers.length - 1, Math.floor(offsetY / answerElement.offsetHeight)));

        if (newIndex !== index) {
          reorderAnswers(questionId, questions.value.find(q => q.id === questionId).answers[index].id, newIndex);
          draggedAnswerIndex.value[questionId] = newIndex;
        }
      }

      function stopDragAnswer() {
        isDraggingAnswer.value = false;
        delete draggedAnswerIndex.value[questionId];
        document.removeEventListener('mousemove', handleDragAnswer);
        document.removeEventListener('mouseup', stopDragAnswer);
        document.removeEventListener('touchmove', handleDragAnswer);
        document.removeEventListener('touchend', stopDragAnswer);
      }
    }

    Vue.onMounted(() => {
      const containers = document.querySelectorAll('.bg-gray-700');
      containers.forEach(container => {
        answersContainers.value[container.dataset.questionId] = container.querySelector('.space-y-2');
      });
    });

    return {
      questions,
      drafts,
      newQuestion,
      newQuestionId,
      newAnswer,
      newAnswerId,
      startDragQuestion,
      addQuestionLocal,
      updateQuestion,
      removeQuestion,
      reorderQuestions,
      addAnswerLocal,
      updateAnswer,
      removeAnswer,
      reorderAnswers,
      voteAnswer,
      startQuestionDraft,
      startDragAnswer,
      stopQuestionDraft,
      startAnswerDraft,
      stopAnswerDraft,
      isDraggingQuestion,
      draggedQuestionIndex,
      isDraggingAnswer,
      draggedAnswerIndex,
      questionsContainer,
      answersContainers,
    };
  },
};