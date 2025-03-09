// components/ViewerQuestions.js
import { useQuestions } from '../composables/useQuestions.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useClips } from '../composables/useClips.js';
import { useLLM } from '../composables/useLLM.js';

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
              <div class="flex-1 text-white break-words min-h-[1.5em]">
                <div
                  v-if="!editingAnswer[answer.id]"
                  class="markdown-body"
                  @click="startEditing(answer.id)"
                  v-html="renderMarkdown(answer.data.text) || '&nbsp;'"
                ></div>
                <div
                  v-else
                  ref="answerInput"
                  contenteditable="true"
                  @input="updateAnswer(answer.id, answer.data.questionId, $event.target.textContent)"
                  @blur="stopEditing(answer.id, answer.data.questionId, $event.target.textContent)"
                  @keypress.enter.prevent="stopEditing(answer.id, answer.data.questionId, $event.target.textContent)"
                  class="flex-1 text-white break-words"
                >
                  {{ answer.data.text }}
                </div>
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
          <div class="mt-2 flex gap-2">
            <button @click="addAnswerLocal(question.id)" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg">Add Answer</button>
            <button @click="answerWithAI(question.id)" class="py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg">Answer with AI</button>
          </div>
          <div v-if="!question.data.answers?.length" class="text-gray-400">No answers yet.</div>
        </div>
      </div>
      <div v-if="questionsWithAnswers.length === 0" class="text-gray-400">No questions yet.</div>
    </div>
  `,
  setup() {
    const { questionsWithAnswers, rawQuestions, rawAnswers, addQuestion, updateQuestion, deleteQuestion, reorderQuestions, addAnswer, updateAnswer, deleteAnswer, voteAnswer, addQuestionProgrammatically } = useQuestions();
    const { selectedDocument, documents } = useDocuments();
    const { clips } = useClips();
    const { llmRequests, triggerLLM } = useLLM();
    const newQuestion = Vue.ref('');
    const answerInput = Vue.ref([]);
    const answerLLMMap = Vue.ref({}); // { llmId: answerId }
    const editingAnswer = Vue.ref({}); // { answerId: true/false }

    const renderMarkdown = (content) => {
      if (!content) return "";

      try {
        let textContent =
          typeof content === "object"
            ? JSON.stringify(content, null, 2)
            : String(content);

        if (
          textContent.trim().startsWith("{") ||
          textContent.trim().startsWith("[")
        ) {
          try {
            const parsed = JSON.parse(textContent);
            textContent =
              "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
          } catch (e) {
            textContent = "```json\n" + textContent + "\n```";
          }
        }

        const md = markdownit({
          html: true,
          breaks: true,
          linkify: true,
          typographer: true,
          highlight: function (str, lang) {
            if (lang === "json") {
              try {
                const parsed = JSON.parse(str);
                str = JSON.stringify(parsed, null, 2);
              } catch (e) {
                // Keep original string if parsing fails
              }
            }
            return '<pre class="hljs"><code>' + str + "</code></pre>";
          },
        });

        md.enable("table");
        return md.render(textContent);
      } catch (error) {
        console.error("Error in renderMarkdown:", error);
        return `<pre class="hljs"><code>${content}</code></pre>`;
      }
    };

    function addQuestionLocal() {
      if (newQuestion.value.trim()) {
        addQuestion(newQuestion.value);
        newQuestion.value = '';
      }
    }

    function addAnswerLocal(questionId) {
      const answerId = addAnswer(questionId);
      Vue.nextTick(() => {
        editingAnswer.value[answerId] = true;
        Vue.nextTick(() => {
          const answerEl = answerInput.value.find(el => rawAnswers.value.some(a => a.id === answerId && a.data.questionId === questionId));
          if (answerEl) answerEl.focus();
        });
      });
    }

    function startEditing(answerId) {
      editingAnswer.value[answerId] = true;
      Vue.nextTick(() => {
        const answerEl = answerInput.value.find(el => rawAnswers.value.some(a => a.id === answerId));
        if (answerEl) answerEl.focus();
      });
    }

    function stopEditing(answerId, questionId, text) {
      updateAnswer(answerId, questionId, text);
      editingAnswer.value[answerId] = false;
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

    function answerWithAI(questionId) {
      const answerId = addAnswer(questionId);
      const llmId = uuidv4();
      answerLLMMap.value[llmId] = answerId;

      const question = rawQuestions.value.find(q => q.id === questionId);
      const questionText = question ? question.data.text : '';
      const materials = documents.value.map(doc => doc.data.pagesText || '').join('\n');
      const userPrompt = `attempt to answer this question using the attached materials: "${questionText}"\n\nHere are the materials to reference:\n${materials}`;

      triggerLLM(
        llmId,
        { provider: 'gemini', model: 'gemini-2.0-flash-exp', name: "gemini-2.0-flash-exp" },
        0.5,
        'You will answer this question clearly, and provide a clear summary. Do not invent any information, just reference only what is provided.',
        userPrompt,
        [],
        false
      );
    }

    Vue.watch(llmRequests, (newRequests) => {
      Object.entries(newRequests).forEach(([llmId, request]) => {
        const answerId = answerLLMMap.value[llmId];
        if (answerId && request.llmResponse) {
          const answer = rawAnswers.value.find(a => a.id === answerId);
          if (answer && answer.data.text !== request.llmResponse) {
            updateAnswer(answerId, answer.data.questionId, request.llmResponse);
          }
        }
      });
    }, { deep: true });

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
      answerWithAI,
      renderMarkdown,
      editingAnswer,
      startEditing,
      stopEditing,
    };
  },
};