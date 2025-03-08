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
          @keypress.enter="addQuestionLocal"
          class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          placeholder="Ask a question..."
        />
        <button @click="addQuestionLocal" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg">Add</button>
      </div>
      <div ref="questionsContainer" class="space-y-4 overflow-y-auto flex-1">
        <div
          v-for="(question, index) in questionsWithAnswers"
          :key="question.id"
          class="bg-gray-700 rounded-lg p-4 transition-transform duration-300"
        >
          <div class="flex items-center gap-2 mb-2">
            <div
              contenteditable="true"
              @input="updateQuestion(question.id, $event.target.textContent)"
              @blur="$event.target.textContent = question.data.text"
              class="flex-1 text-white break-words"
            >
              {{ question.data.text }}
            </div>
            <button @click.stop="moveQuestionUp(question.id, index)" class="text-blue-400 hover:text-blue-300">
              ↑
            </button>
            <button @click.stop="moveQuestionDown(question.id, index)" class="text-blue-400 hover:text-blue-300">
              ↓
            </button>
            <button @click.stop="deleteQuestion(question.id)" class="text-red-400 hover:text-red-300">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="space-y-2 ml-4">
            <div
              v-for="(answer, ansIndex) in question.data.answers"
              :key="answer.id"
              class="p-2 bg-gray-600 rounded-lg flex items-center gap-2 transition-transform duration-300"
            >
              <div
                ref="answerInput"
                contenteditable="true"
                @input="updateAnswer(answer.id, answer.data.questionId, $event.target.textContent)"
                @keypress.enter="$event.target.blur()"
                @blur="$event.target.textContent = answer.data.text"
                class="flex-1 text-white break-words"
              >
                {{ answer.data.text }}
              </div>
              <div class="flex gap-2">
                <button @click="voteAnswer(answer.data.questionId, answer.id, 'up')" class="text-green-400">↑ {{ answer.data.votes || 0 }}</button>
                <button @click="voteAnswer(answer.data.questionId, answer.id, 'down')" class="text-red-400">↓</button>
                <button @click.stop="deleteAnswer(answer.id, answer.data.questionId)" class="text-red-400 hover:text-red-300">
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </div>
          </div>
          <button @click="addAnswerLocal(question.id)" class="mt-2 py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg">Add Answer</button>
          <div v-if="!question.data.answers?.length" class="text-gray-400">No answers yet.</div>
        </div>
      </div>
      <div v-if="questionsWithAnswers.length === 0" class="text-gray-400">No questions yet.</div>
    </div>
  `,
  setup() {


    const { questionsWithAnswers, rawQuestions, rawAnswers, addQuestion, updateQuestion, deleteQuestion, reorderQuestions, addAnswer, updateAnswer, deleteAnswer, voteAnswer, addQuestionProgrammatically } = useQuestions();
    console.log('ViewerQuestions initialized with questionsWithAnswers:', questionsWithAnswers.value);
    const { selectedDocument, documents } = useDocuments();
    const { clips } = useClips();
    const newQuestion = Vue.ref('');
    const answerInput = Vue.ref([]);

    function addQuestionLocal() {
      if (newQuestion.value.trim()) {
        addQuestion(newQuestion.value);
        newQuestion.value = '';
      }
    }

    function addAnswerLocal(questionId) {
      const answerId = addAnswer(questionId);
      Vue.nextTick(() => {
        const answerEl = answerInput.value.find(el => el.textContent === '' && rawAnswers.value.some(a => a.id === answerId && a.data.questionId === questionId));
        if (answerEl) answerEl.focus();
      });
    }

    function moveQuestionUp(id, currentIndex) {
      if (currentIndex > 0) {
        reorderQuestions(id, currentIndex - 1);
      }
    }

    function moveQuestionDown(id, currentIndex) {
      if (currentIndex < rawQuestions.value.length - 1) {
        reorderQuestions(id, currentIndex + 1);
      }
    }

    return {
      questionsWithAnswers,
      newQuestion,
      addQuestionLocal,
      updateQuestion,
      deleteQuestion,
      reorderQuestions,
      addAnswerLocal,
      updateAnswer,
      deleteAnswer,
      voteAnswer,
      answerInput,
      moveQuestionUp,
      moveQuestionDown,
    };
  },
};