// components/ViewerQuestions.js
import { useQuestions } from '../composables/useQuestions.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useLLM } from '../composables/useLLM.js';
import { useScrollNavigation } from '../composables/useScrollNavigation.js';
import { useArtifacts } from '../composables/useArtifacts.js';
import ViewerEditor from './ViewerEditor.js';

export default {
  name: 'ViewerQuestions',
  components: { ViewerEditor },
  template: `
    <div class="h-full flex flex-col overflow-hidden p-4">
      <!-- Question Input and Add Button -->
      <div class="flex gap-2 mb-4">
        <input
          v-model="newQuestion"
          @keypress.enter="addQuestionLocal"
          class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          placeholder="Ask a question..."
        />
        <button @click="addQuestionLocal" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg">Add</button>
      </div>

      <!-- Filter Input -->
      <input
        v-model="filterQuery"
        class="mb-4 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
        placeholder="Filter questions..."
      />
      <!-- Tabs -->
      <div class="flex gap-2 mb-4">
        <button
          v-for="tab in tabs"
          :key="tab"
          @click="activeTab = tab"
          :class="[
            'py-2 px-4 rounded-lg',
            activeTab === tab ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          ]"
        >
          {{ tab }}
        </button>
      </div>
      <!-- Questions Container -->
      <div ref="questionsContainer" class="space-y-4 overflow-y-auto flex-1">
        <div
          v-for="(question, index) in filteredQuestions"
          :key="question.id"
          class="bg-gray-700 rounded-lg p-4 transition-transform duration-300"
        >
          <div class="flex items-center gap-2 mb-2">
            <i
              :class="[
                'pi pi-check cursor-pointer',
                question.data.answered ? 'text-green-500' : 'text-white'
              ]"
              @click="toggleAnswered(question.id, question.data.answered)"
            ></i>
            <span class="text-gray-400 mr-2">{{ question.data.order + 1 }}.</span>
            <div v-if="!editingQuestion[question.id]" class="flex-1 text-white break-words whitespace-pre-wrap" @click="startEditingQuestion(question.id)">
              {{ question.data.text }}
            </div>
            <input
              v-else
              ref="questionInput"
              v-model="questionEditText[question.id]"
              @keypress.enter="stopEditingQuestion(question.id)"
              @blur="stopEditingQuestion(question.id)"
              class="flex-1 p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              @paste="handlePaste($event)"
            />
            <button @click="moveQuestionUp(question.id, index)" class="text-blue-400 hover:text-blue-300">↑</button>
            <button @click="moveQuestionDown(question.id, index)" class="text-blue-400 hover:text-blue-300">↓</button>
            <button @click="toggleCollapse(question.id)" class="text-blue-400 hover:text-blue-300">
              {{ question.data.collapsed ? 'Expand' : 'Collapse' }}
            </button>
            <button @click="deleteQuestion(question.id)" class="text-red-400 hover:text-red-300">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div v-if="!question.data.collapsed" class="space-y-2 ml-4">
            <div
              v-for="(answer, ansIndex) in question.data.answers"
              :key="answer.id"
              class="answer-container"  
              :class="[
                'p-2 rounded-lg flex flex-col gap-2 transition-transform duration-300',
                topAnswerIds[answer.id] ? 'bg-green-800' : 'bg-gray-600'
              ]"
            >
              <div class="flex items-center gap-2">
                <div class="flex-1 text-white break-words min-h-[1.5em]">
                  <div
                    v-if="!editingAnswer[answer.id]"
                    class="markdown-body"
                    @click="startEditingAnswer(answer.id)"
                    v-html="renderMarkdown(answer.data.text) || ' '"
                  ></div>
                  <textarea
                    v-else
                    ref="answerInput"
                    v-model="answerEditText[answer.id]"
                    @keypress.enter.prevent="stopEditingAnswer(answer.id, answer.data.questionId)"
                    @blur="stopEditingAnswer(answer.id, answer.data.questionId)"
                    class="w-full h-[300px] p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                    @paste="handlePaste($event)"
                  ></textarea>
                </div>
                <div class="flex gap-2">
                  <button @click="voteAnswer(answer.data.questionId, answer.id, 'up')" class="text-green-400">↑ {{ answer.data.votes || 0 }}</button>
                  <button @click="voteAnswer(answer.data.questionId, answer.id, 'down')" class="text-red-400">↓</button>
                  <button @click="deleteAnswer(answer.id, answer.data.questionId)" class="text-red-400 hover:text-red-300">
                    <i class="pi pi-times"></i>
                  </button>
                </div>
              </div>
              <!-- Answer Links -->
              <div v-if="answer.data.links && answer.data.links.length" class="text-sm text-blue-400 mt-2">
                <div
                  v-for="link in answer.data.links"
                  :key="link.id"
                  class="cursor-pointer hover:underline"
                >
                  <button
                    @click="deleteLink(answer.id, answer.data.questionId, link.id, link.page)"
                    class="text-red-400 hover:text-red-300"
                  >
                    <i class="pi pi-trash"></i>
                  </button>
                  <span @click="openDocumentModal(link.id, link.page)" class="ml-2"> {{ getDocumentName(link.id) }} (Page {{ link.page }}) </span>
                </div>
              </div>
              <!-- Add Link Button for Each Answer -->
              <div class="flex items-center gap-2 mt-1">
                <span class="text-gray-400 text-md">Links:</span>
                <button @click="openAddLinkModal(question.id, answer.id)" class="text-white hover:text-gray-300 text-md">+</button>
              </div>
            </div>
          </div>
          <div v-if="!question.data.collapsed" class="mt-2 flex gap-2">
            <button @click="addAnswerLocal(question.id)" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg">Add Answer</button>
            <button @click="answerWithAI(question.id)" class="py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg">Answer with AI</button>
          </div>
          <div v-if="!question.data.answers?.length && !question.data.collapsed" class="text-gray-400">No answers yet.</div>
        </div>
        <div v-if="filteredQuestions.length === 0" class="text-gray-400">No questions match your filter.</div>
    
         <div class="h-[200px]"></div>
    
        </div>

      <!-- Add Link Modal -->
      <div v-if="showAddLinkModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg w-1/3">
          <h3 class="text-white mb-4">Add Link</h3>
          <select v-model="selectedDocumentId" class="w-full p-2 mb-4 bg-gray-700 text-white rounded-lg">
            <option v-for="doc in documents" :key="doc.id" :value="doc.id">{{ doc.data.name }}</option>
          </select>
          <input
            v-model="linkPageNumber"
            type="number"
            class="w-full p-2 mb-4 bg-gray-700 text-white rounded-lg"
            placeholder="Page Number"
          />
          <div class="flex gap-2">
            <button @click="addLink" class="py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg">Add</button>
            <button @click="showAddLinkModal = false" class="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Document Modal with Teleport -->
      <teleport to="#modal-portal">
       <div v-if="showDocumentModal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
  <div class="relative w-full h-full z-50">
    <viewer-editor
      v-if="selectedDocument || selectedArtifact"
      :item="selectedDocument || selectedArtifact"
      class="h-full z-50 pt-12"
    />
    <button 
      @click="closeDocumentModal" 
      class="absolute top-4 right-4 text-white text-3xl z-60"
    >
      X
    </button>
  </div>
</div>

      </teleport>
    </div>
  `,
  setup() {
    const { questionsWithAnswers, rawQuestions, rawAnswers, addQuestion, updateQuestion, deleteQuestion, reorderQuestions, addAnswer, updateAnswer, deleteAnswer, voteAnswer, addLinkProgrammatically } = useQuestions();
    const { selectedDocument, documents, setSelectedDocument } = useDocuments();
    const { llmRequests, triggerLLM } = useLLM();
    const { jumpToPageNumber } = useScrollNavigation();
    const { artifacts, selectedArtifact } = useArtifacts();
    const newQuestion = Vue.ref('');
    const answerInput = Vue.ref([]);
    const questionInput = Vue.ref([]);
    const answerLLMMap = Vue.ref({});
    const editingAnswer = Vue.ref({});
    const editingQuestion = Vue.ref({});
    const questionEditText = Vue.ref({});
    const answerEditText = Vue.ref({});
    const activeTab = Vue.ref('Active');
    const tabs = ['Active', 'Answered'];
    const filterQuery = Vue.ref('');
    const showAddLinkModal = Vue.ref(false);
    const selectedQuestionId = Vue.ref(null);
    const selectedAnswerId = Vue.ref(null);
    const selectedDocumentId = Vue.ref(null);
    const linkPageNumber = Vue.ref('');
    const showDocumentModal = Vue.ref(false);
    const modalKey = Vue.ref(0);
    const modalDocuments = Vue.ref([]);
    const modalSelectedDocument = Vue.ref(null);
    const modalJumpToPageNumber = Vue.ref(null);

    const renderMarkdown = (content) => {
      if (!content) return "";
      try {
        let textContent = typeof content === "object" ? JSON.stringify(content, null, 2) : String(content);
        if (textContent.trim().startsWith("{") || textContent.trim().startsWith("[")) {
          try {
            const parsed = JSON.parse(textContent);
            textContent = "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
          } catch (e) {
            textContent = "```json\n" + textContent + "\n```";
          }
        }
        const md = markdownit({ html: true, breaks: true, linkify: true, typographer: true });
        return md.render(textContent);
      } catch (error) {
        console.error("Error in renderMarkdown:", error);
        return `<pre class="hljs"><code>${content}</code></pre>`;
      }
    };

    const filteredQuestions = Vue.computed(() => {
      const query = filterQuery.value.toLowerCase();
      return questionsWithAnswers.value
        .filter(q => activeTab.value === 'Active' ? !q.data.answered : q.data.answered)
        .filter(q => query.length < 3 || q.data.text.toLowerCase().includes(query))
        .sort((a, b) => a.data.order - b.data.order);
    });

    function addQuestionLocal() {
      if (newQuestion.value.trim()) {
        addQuestion(newQuestion.value);
        newQuestion.value = '';
      }
    }

    function addAnswerLocal(questionId) {
      const answerId = addAnswer(questionId);
      Vue.nextTick(() => {
        startEditingAnswer(answerId);
      });
    }

    function startEditingQuestion(questionId) {
      const question = rawQuestions.value.find(q => q.id === questionId);
      if (question) {
        editingQuestion.value[questionId] = true;
        questionEditText.value[questionId] = question.data.text;
        Vue.nextTick(() => {
          const inputEl = questionInput.value.find(el => el === document.activeElement);
          if (inputEl) inputEl.focus();
        });
      }
    }

    function stopEditingQuestion(questionId) {
      if (editingQuestion.value[questionId]) {
        updateQuestion(questionId, { text: questionEditText.value[questionId] });
        editingQuestion.value[questionId] = false;
      }
    }

    function startEditingAnswer(answerId) {
      const answer = rawAnswers.value.find(a => a.id === answerId);
      if (answer) {
        editingAnswer.value[answerId] = true;
        answerEditText.value[answerId] = answer.data.text;
        Vue.nextTick(() => {
          const inputEl = answerInput.value.find(el => el === document.activeElement);
          if (inputEl) inputEl.focus();
        });
      }
    }

    function stopEditingAnswer(answerId, questionId) {
      if (editingAnswer.value[answerId]) {
        updateAnswer(answerId, questionId, { text: answerEditText.value[answerId] });
        editingAnswer.value[answerId] = false;
      }
    }

    function moveQuestionUp(id, currentIndex) {
      if (currentIndex > 0) {
        reorderQuestions(id, currentIndex - 1);
      }
    }

    function moveQuestionDown(id, currentIndex) {
      if (currentIndex < filteredQuestions.value.length - 1) {
        reorderQuestions(id, currentIndex + 1);
      }
    }

    function toggleAnswered(id, answered) {
      updateQuestion(id, { answered: !answered });
    }

    function toggleCollapse(id) {
      const question = rawQuestions.value.find(q => q.id === id);
      if (question) {
        updateQuestion(id, { collapsed: !question.data.collapsed });
      }
    }

    function openAddLinkModal(questionId, answerId) {
      selectedQuestionId.value = questionId;
      selectedAnswerId.value = answerId;
      showAddLinkModal.value = true;
    }

    function addLink() {
      if (selectedQuestionId.value && selectedAnswerId.value && selectedDocumentId.value && linkPageNumber.value) {
        addLinkProgrammatically(selectedAnswerId.value, selectedDocumentId.value, parseInt(linkPageNumber.value));
        showAddLinkModal.value = false;
        selectedDocumentId.value = null;
        linkPageNumber.value = '';
        selectedAnswerId.value = null;
      }
    }

    function getDocumentName(docId) {
      const doc = documents.value.find(d => d.id === docId);
      const arti = artifacts.value.find(d => d.id === docId);
      return arti?.data?.name || doc?.data?.name || "Unknown Document/Artifact";
    }

    function openDocumentModal(docId, page) {
      const doc = documents.value.find(d => d.id === docId);
      const arti = artifacts.value.find(d => d.id === docId);

      if (doc?.id) {
        selectedArtifact.value = null;
        selectedDocument.value = JSON.parse(JSON.stringify(documents.value.find(d => d.id === docId) || null));
        jumpToPageNumber.value = page;
        modalKey.value += 1;
      }

      if (arti?.id) {
        selectedDocument.value = null;
        selectedArtifact.value = JSON.parse(JSON.stringify(artifacts.value.find(d => d.id === docId) || null));
        jumpToPageNumber.value = 0;
        modalKey.value += 1;
      }

      showDocumentModal.value = true;
    }

    function closeDocumentModal() {
      modalSelectedDocument.value = null;
      modalJumpToPageNumber.value = null;
      showDocumentModal.value = false;
    }

    function answerWithAI(questionId) {
      const answerId = addAnswer(questionId);
      const llmId = uuidv4();
      answerLLMMap.value[llmId] = answerId;

      const question = rawQuestions.value.find(q => q.id === questionId);
      const questionText = question ? question.data.text : '';
      const documentMaterials = documents.value.map(doc => ({
        documentId: doc.id,
        name: doc.data.name,
        pages: JSON.stringify(doc.data.pagesText.map((text, index) => ({ id: doc.id, page: index + 1, text })))
      }));
      const artifactMaterials = artifacts.value.map(artifact => ({
        artifactId: artifact.id,
        name: artifact.data.name,
        content: JSON.stringify(artifact.data.pagesText.map((text, index) => ({ id: artifact.id, page: index + 1, text })))
      }));
      const materials = { documents: documentMaterials, artifacts: artifactMaterials };
      const userPrompt = `
        Answer the following question using the provided materials, without repeating the question in the response: "${questionText}"
        Provide a single, clean JSON array of references at the end in the format: [{"id": "documentId or artifactId", "page": number}]
        Materials: ${JSON.stringify(materials)}
      `;

      triggerLLM(
        llmId,
        { provider: 'gemini', model: 'gemini-2.0-flash', name: "gemini-2.0-flash" },
        0.5,
        `
        Answer the question clearly and provide adequate details.  
        Where applicable, provide answers from various pages and documents or artifacts, although only where there is information which clearly relates to the question. 
        
        Do not include the question or materials in the response.

        At the end, provide exactly one JSON array containing objects with {"id": "documentId or artifactId", "page": number} where you found the relevant information. The id is found in the json of the reference materials.
        Try to provide at least 3 links per response, which are always in the same JSON array at the end of your response. 
        `,
        userPrompt,
        [],
        false
      );
    }

    function handlePaste(event) {
      event.preventDefault();
      const text = (event.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    }

    Vue.watch(llmRequests, (newRequests) => {
      Object.entries(newRequests).forEach(([llmId, request]) => {
        const answerId = answerLLMMap.value[llmId];
        if (answerId && request.llmResponse) {
          const answer = rawAnswers.value.find(a => a.id === answerId);
          if (answer) {
            let responseText = request.llmResponse.trim();
            let links = [];

            const jsonMatches = responseText.match(/\[[\s\S]*?\]/g);
            if (jsonMatches && jsonMatches.length > 0) {
              const lastJsonStr = jsonMatches[jsonMatches.length - 1];
              try {
                const parsed = JSON5.parse(lastJsonStr);
                if (Array.isArray(parsed) && parsed.every(l => l.id && l.page)) {
                  links = parsed;
                  responseText = responseText.replace(lastJsonStr, '').trim();
                  responseText = responseText.replaceAll("```json", '').trim();
                  responseText = responseText.replaceAll("```", '').trim();
                }
              } catch (e) {
                console.error('Failed to parse JSON from LLM response:', e, lastJsonStr);
              }
            }

            console.log('Processed LLM Response:', { responseText, links });

            if (!request.isStreaming) {
              updateAnswer(answerId, answer.data.questionId, { text: responseText, links });
            } else if (answer.data.text !== responseText) {
              updateAnswer(answerId, answer.data.questionId, { text: responseText });
            }
          }
        }
      });
    }, { deep: true });

    const topAnswerIds = Vue.computed(() => {
      const topIds = {};
      questionsWithAnswers.value.forEach(question => {
        const answers = question.data.answers || [];
        if (answers.length === 0) return;

        const maxVotes = Math.max(...answers.map(a => a.data.votes || 0));
        if (maxVotes > 0) {
          answers.forEach(answer => {
            if ((answer.data.votes || 0) === maxVotes) {
              topIds[answer.id] = true;
            }
          });
        }
      });
      return topIds;
    });

    function deleteLink(answerId, questionId, linkId, linkPage) {
      const answer = rawAnswers.value.find(a => a.id === answerId && a.data.questionId === questionId);
      if (answer && answer.data.links) {
        const updatedLinks = answer.data.links.filter(link => !(link.id === linkId && link.page === linkPage));
        updateAnswer(answerId, questionId, { links: updatedLinks });
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
      questionInput,
      moveQuestionUp,
      moveQuestionDown,
      answerWithAI,
      renderMarkdown,
      editingAnswer,
      editingQuestion,
      questionEditText,
      answerEditText,
      startEditingQuestion,
      stopEditingQuestion,
      startEditingAnswer,
      stopEditingAnswer,
      activeTab,
      tabs,
      filterQuery,
      filteredQuestions,
      toggleAnswered,
      toggleCollapse,
      showAddLinkModal,
      selectedDocumentId,
      linkPageNumber,
      addLink,
      openAddLinkModal,
      selectedQuestionId,
      selectedAnswerId,
      documents,
      getDocumentName,
      openDocumentModal,
      closeDocumentModal,
      showDocumentModal,
      modalKey,
      modalDocuments,
      modalSelectedDocument,
      modalJumpToPageNumber,
      topAnswerIds,
      deleteLink,
      handlePaste,
      selectedArtifact,
      selectedDocument,
    };
  },
};