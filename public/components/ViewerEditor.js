// components/ViewerEditor.js
import LazyScrollViewer from './LazyScrollViewer.js';
import OcrPromptEditor from './OcrPromptEditor.js';
import { useFiles } from '../composables/useFiles.js';
import { useRealTime } from '../composables/useRealTime.js';
import { useDocuments } from '../composables/useDocuments.js';
import { useArtifacts } from '../composables/useArtifacts.js';

export default {
  name: 'ViewerEditor',
  components: { LazyScrollViewer, OcrPromptEditor },
  props: {
    item: { type: Object, required: true },
  },
  setup(props) {
    const { userUuid, emit } = useRealTime();
    const { updateDocument, updateDocumentOcr } = useDocuments();
    const { updateArtifact } = useArtifacts();
    const { ocrFiles, retrieveFiles, files, ocrPrompt, resetOcrPrompt } = useFiles();

    const displayMode = Vue.ref('default');
    const initialDisplayMode = Vue.ref('default');
    const isEditing = Vue.ref(false);
    const editedContent = Vue.ref([]);
    const lazyScrollViewer = Vue.ref(null);
    const jumpToPageInput = Vue.ref('');
    const currentPage = Vue.ref(0);
    const isOcrLoading = Vue.ref(false);
    const showOcrPromptEditor = Vue.ref(false);
    const md = markdownit({ html: true, linkify: true, typographer: true, breaks: true });
    const ocrProgress = Vue.ref(0);
    const isOcrAllRunning = Vue.ref(false);
    let ocrAllAbortController = null;

    const imageTypes = ['png', 'jpg', 'jpeg', 'webp'];

    const dropdownOptions = Vue.computed(() => {
      const type = props.item.data.type || (props.item.type === 'artifact' ? 'md' : 'text');
      if (type === 'pdf') return ['PDF', 'Text'];
      if (type === 'docx') return ['HTML', 'Text'];
      if (type === 'xlsx' || type === 'csv') return ['Table', 'JSON'];
      if (props.item.type === 'artifact' && type === 'md') return ['Markdown'];
      if (props.item.type === 'artifact' && type === 'image') return ['Image', 'Markdown'];
      if (type === 'svg') return ['Image', 'Text'];
      if (imageTypes.includes(type)) return ['Image', 'Text'];
      return ['Text'];
    });

    Vue.watch(
      () => props.item,
      (newItem) => {
        const type = newItem.data.type || (newItem.type === 'artifact' ? 'md' : 'text');
        displayMode.value = type === 'pdf' ? 'PDF' : 
                           type === 'docx' ? 'HTML' : 
                           (type === 'xlsx' || type === 'csv') ? 'Table' : 
                           (props.item.type === 'artifact' && type === 'md') ? 'Markdown' : 
                           (props.item.type === 'artifact' && type === 'image') ? 'Image' : 
                           (type === 'svg') ? 'Image' :
                           (imageTypes.includes(type)) ? 'Image' : 'Text';
        console.log('ViewerEditor item updated:', newItem, 'type:', type, 'displayMode:', displayMode.value);
      },
      { immediate: true, deep: true }
    );

    const renderedContent = Vue.computed(() => {
      console.log('Computing renderedContent for:', props.item.data, 'displayMode:', displayMode.value, 'isEditing:', isEditing.value);
      const { pages, pagesText, pagesHtml, type: rawType, renderAs } = props.item.data;
      const type = rawType || (props.item.type === 'artifact' ? 'md' : 'text');
      if (isEditing.value) {
        console.log('Returning editedContent:', editedContent.value);
        return editedContent.value;
      }

      if (type === 'pdf' && displayMode.value === 'PDF') {
        console.log('PDF mode, pages:', pages, 'pagesText:', pagesText);
        if (pages?.length) {
          return pages;
        } else {
          return ['<p>Please click "Render Files" or the eye icon to render the PDF.</p>'];
        }
      }
      if (type === 'docx' && (displayMode.value === 'HTML' || displayMode.value === 'default')) {
        console.log('DOCX HTML mode, returning pagesHtml:', pagesHtml);
        return pagesHtml?.length ? pagesHtml : [];
      }
      if (type === 'docx' && displayMode.value === 'Text') {
        console.log('DOCX Text mode, rendering pagesText with markdown:', pagesText);
        return pagesText?.length ? pagesText.map(text => md.render(text || '')) : [];
      }
      if ((type === 'xlsx' || type === 'csv') && displayMode.value === 'Table') {
        console.log('XLSX/CSV Table mode, rendering pagesText as table:', pagesText);
        return pagesText?.length ? pagesText.map(sheet => {
          const data = JSON.parse(sheet);
          const sheetName = Object.keys(data)[0];
          const rows = data[sheetName];
          return `
            <table class="w-full border-collapse">
              <thead><tr>${Object.keys(rows[0]).map(h => `<th class="border p-2 bg-[#2d3748] text-[#e2e8f0]">${h}</th>`).join('')}</tr></thead>
              <tbody>${rows.map(row => `<tr>${Object.values(row).map(v => `<td class="border p-2 text-[#e2e8f0]">${JSON.stringify(v)}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          `;
        }) : [];
      }
      if ((type === 'xlsx' || type === 'csv') && displayMode.value === 'JSON') {
        console.log('XLSX/CSV JSON mode, returning pagesText:', pagesText);
        return pagesText?.length ? pagesText : [];
      }
      if (renderAs === 'markdown' || displayMode.value === 'Markdown' || (props.item.type === 'artifact' && type === 'md')) {
        console.log('Markdown mode, rendering pagesText with markdown:', pagesText);
        return pagesText?.length ? pagesText.map(text => md.render(text || '')) : ['<p>No content available.</p>'];
      }
      if (props.item.type === 'artifact' && type === 'image' && displayMode.value === 'Image') {
        console.log('Artifact Image mode, rendering base64 image:', pages);
        if (pages?.length) {
          return [`<img src="data:image/jpeg;base64,${pages[0]}" alt="Generated Image" class="max-w-full rounded-lg" />`];
        }
        return ['<p>No image data available.</p>'];
      }
      if (imageTypes.includes(type) && displayMode.value === 'Image') {
        console.log('Image mode, rendering image:', pages);
        if (!pages?.length) {
          if (!files.value[props.item.id]) {
            retrieveFiles([props.item.id]);
          }
          const file = files.value[props.item.id];
          if (file && file.data) {
            const blob = new Blob([file.data], { type: file.mimeType });
            const url = URL.createObjectURL(blob);
            props.item.data.pages = [url];
            return [`<img src="${url}" style="max-width: 100%; height: auto;" />`];
          }
          return ['<p>Please click the eye icon to load the image.</p>'];
        }
        return pages.map(url => `<img src="${url}" style="max-width: 100%; height: auto;" />`);
      }
      if ((imageTypes.includes(type) || type === 'svg') && displayMode.value === 'Text') {
        console.log('Image/SVG Text mode, rendering pagesText:', pagesText);
        return pagesText?.length ? pagesText : [''];
      }
      if (type === 'svg' && displayMode.value === 'Image') {
        console.log('SVG Image mode, rendering SVG:', pagesText);
        return pagesText?.length ? pagesText : [];
      }

      console.log('Default mode, rendering pagesText:', pagesText);
      if (pagesText?.length) {
        const supportedLanguages = ['js', 'javascript', 'css', 'html', 'py', 'python', 'sql', 'java', 'c', 'svg'];
        const fileType = type.toLowerCase();
        const language = supportedLanguages.includes(fileType) ? (fileType === 'js' ? 'javascript' : fileType) : 'text';
        if (language !== 'text') {
          return pagesText.map(text => {
            const highlighted = Prism.highlight(text || '', Prism.languages[language], language);
            return `<pre class="language-${language}">${highlighted}</pre>`;
          });
        }
      }
      return pagesText?.length ? pagesText : [];
    });

    const startEditing = () => {
      console.log('startEditing: item:', props.item, 'type:', props.item.type);
      isEditing.value = true;
      initialDisplayMode.value = displayMode.value;
      if (props.item.data.type === 'docx' && displayMode.value === 'HTML') {
        editedContent.value = [...props.item.data.pagesHtml];
      } else {
        editedContent.value = [...(props.item.data.pagesText || [])];
      }
      const updateFn = props.item.type === 'document' ? updateDocument : updateArtifact;
      updateFn(props.item.id, { editStatus: true, editor: userUuid.value });
    };

    const finishEditing = () => {
      console.log('finishEditing: item:', props.item, 'type:', props.item.type);
      isEditing.value = false;
      const updateFn = props.item.type === 'document' ? updateDocument : updateArtifact;
      const currentData = { ...props.item.data };
      const updates = initialDisplayMode.value === 'HTML' && props.item.data.type === 'docx' 
        ? { 
            name: currentData.name,
            type: currentData.type,
            mimeType: currentData.mimeType,
            size: currentData.size,
            lastModified: currentData.lastModified,
            status: currentData.status,
            sectionId: currentData.sectionId,
            pages: currentData.pages,
            pagesText: currentData.pagesText,
            pagesHtml: editedContent.value,
            renderAs: currentData.renderAs,
            editStatus: false,
            editor: null
          }
        : { 
            name: currentData.name,
            type: currentData.type,
            mimeType: currentData.mimeType,
            size: currentData.size,
            lastModified: currentData.lastModified,
            status: currentData.status,
            sectionId: currentData.sectionId,
            pages: currentData.pages,
            pagesText: editedContent.value,
            pagesHtml: currentData.pagesHtml,
            renderAs: currentData.renderAs,
            editStatus: false,
            editor: null
          };
      console.log('finishEditing: updates:', updates, 'updateFn:', updateFn.name);
      updateFn(props.item.id, updates);
    };

    const saveCursorPosition = (element) => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        const start = preCaretRange.toString().length;
        return start;
      }
      return 0;
    };

    const restoreCursorPosition = (element, position) => {
      const selection = window.getSelection();
      let charIndex = 0, range = document.createRange();
      range.setStart(element, 0);
      range.collapse(true);
      const nodeStack = [element];
      let found = false;

      while (nodeStack.length > 0) {
        const node = nodeStack.pop();
        if (node.nodeType === Node.TEXT_NODE) {
          const nextCharIndex = charIndex + node.length;
          if (!found && position >= charIndex && position <= nextCharIndex) {
            range.setStart(node, position - charIndex);
            range.setEnd(node, position - charIndex);
            found = true;
          }
          charIndex = nextCharIndex;
        } else {
          for (let i = node.childNodes.length - 1; i >= 0; i--) {
            nodeStack.push(node.childNodes[i]);
          }
        }
      }

      if (!found) {
        range.setStart(element, element.childNodes.length);
        range.setEnd(element, element.childNodes.length);
      }

      selection.removeAllRanges();
      selection.addRange(range);
    };

    const handleDocxInput = (index, event) => {
      const element = event.target;
      const position = saveCursorPosition(element);
      editedContent.value[index] = element.innerHTML;
      console.log('handleDocxInput: updated editedContent:', editedContent.value);
      Vue.nextTick(() => restoreCursorPosition(element, position));
    };

    const handleTextInput = (index, event) => {
      editedContent.value[index] = event.target.value;
      console.log('handleTextInput: updated editedContent:', editedContent.value);
    };

    const handlePageVisible = (pageIndex) => {
      currentPage.value = pageIndex;
      jumpToPageInput.value = (pageIndex + 1).toString();
      console.log('Current page updated:', currentPage.value);
    };

    const ocrPage = async () => {
      try {
        isOcrLoading.value = true;
        const pageToOcr = props.item.data.type === 'pdf' ? currentPage.value : 0;
        const ocrResults = await ocrFiles([props.item.id], [props.item], [pageToOcr]);
        console.log("ocrResults", ocrResults)
        const { uuids, text, pages } = ocrResults;
        if (uuids[0] === props.item.id) {
          const pageIndex = pages[0];
          const ocrText = text[0] || ''; // text[0] is response.data.text[0]
          editedContent.value[pageIndex] = ocrText;
          const updateFn = props.item.type === 'document' ? updateDocumentOcr : updateArtifact;
          if (props.item.type === 'document') {
            updateFn(props.item.id, pageIndex, ocrText);
          } else {
            const updatedPagesText = props.item.data.pagesText ? [...props.item.data.pagesText] : [''];
            updatedPagesText[0] = ocrText;
            console.log('Updating artifact with pagesText:', updatedPagesText); // Log to confirm
            updateFn(props.item.id, { pagesText: updatedPagesText });
          }
        }
      } catch (error) {
        console.error('OCR page failed:', error);
      } finally {
        isOcrLoading.value = false;
      }
    };
    const ocrAllPages = async () => {
      try {
        isOcrLoading.value = true;
        isOcrAllRunning.value = true;
        ocrProgress.value = 0;
        const totalPages = props.item.data.pages?.length || 0;
        const newPagesText = [...(props.item.data.pagesText || Array(totalPages).fill(''))];
        
        for (let page = 0; page < totalPages; page++) {
          if (!isOcrAllRunning.value) break;
          
          try {
            const ocrResults = await ocrFiles([props.item.id], [props.item], [page]);
            const { uuids, text, pages } = ocrResults;
            
            if (uuids[0] === props.item.id && text[0] !== null) {
              const pageIndex = pages[0];
              newPagesText[pageIndex] = text[0];
              
              const updateFn = props.item.type === 'document' ? updateDocument : updateArtifact;
              if (props.item.type === 'document') {
                updateFn(props.item.id, { pagesText: newPagesText });
              } else {
                updateFn(props.item.id, { pagesText: newPagesText });
              }
              
              if (isEditing.value) {
                editedContent.value[pageIndex] = text[0];
              }
            }
            ocrProgress.value = page + 1;
          } catch (error) {
            console.error(`OCR failed for page ${page}:`, error);
          }
        }
      } catch (error) {
        console.error('OCR all pages process failed:', error);
      } finally {
        isOcrLoading.value = false;
        isOcrAllRunning.value = false;
        ocrProgress.value = 0;
      }
    };

    const stopOcrAll = () => {
      isOcrAllRunning.value = false;
    };

    const jumpToPage = () => {
      const pageNum = parseInt(jumpToPageInput.value, 10);
      if (isNaN(pageNum) || pageNum < 1 || pageNum > props.item.data.pages?.length) {
        jumpToPageInput.value = (currentPage.value + 1).toString();
        return;
      }
      lazyScrollViewer.value.scrollToPage(pageNum - 1);
      jumpToPageInput.value = (currentPage.value + 1).toString();
    };

    const openOcrPromptEditor = () => {
      showOcrPromptEditor.value = true;
    };

    const updateOcrPrompt = (newPrompt) => {
      ocrPrompt.value = newPrompt;
      showOcrPromptEditor.value = false;
    };

    const resetOcrPromptHandler = () => {
      console.log("resetOcrPromptHandler in ViewerEditor");
      resetOcrPrompt();
    };

    const closeOcrPromptEditor = () => {
      showOcrPromptEditor.value = false;
    };

    return {
      displayMode,
      isEditing,
      editedContent,
      lazyScrollViewer,
      jumpToPageInput,
      currentPage,
      isOcrLoading,
      showOcrPromptEditor,
      dropdownOptions,
      renderedContent,
      startEditing,
      finishEditing,
      handleDocxInput,
      handleTextInput,
      handlePageVisible,
      ocrPage,
      ocrAllPages,
      stopOcrAll,
      ocrProgress,
      isOcrAllRunning,
      jumpToPage,
      openOcrPromptEditor,
      updateOcrPrompt,
      resetOcrPromptHandler,
      closeOcrPromptEditor,
      ocrPrompt,
    };
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden" :class="{ 'border-2 border-orange-500': item.data.editStatus }">
      <div v-if="item.data.editStatus" class="bg-orange-500 text-white text-sm p-1">
        Currently being edited by {{ item.data.editor }}
      </div>
      <div class="p-2 bg-[#1a2233] border-b border-[#2d3748] sticky top-0 z-20 flex items-center gap-2">
        <select v-if="!isEditing" v-model="displayMode" class="p-1 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] text-sm">
          <option v-for="option in dropdownOptions" :key="option" :value="option">{{ option }}</option>
        </select>
        <button v-if="!isEditing && !(item.data.type === 'pdf' && displayMode === 'PDF')" @click="startEditing" class="p-1 text-[#f59e0b] hover:text-[#d97706]">
          <i class="pi pi-pencil"></i>
        </button>
        <button v-if="isEditing" @click="finishEditing" class="py-1 px-2 bg-[#10b981] text-white rounded-lg text-sm">
          Done
        </button>
        <template v-if="((item.data.type === 'pdf' && displayMode === 'PDF') || (item.data.type && (['png', 'jpg', 'jpeg', 'webp'].includes(item.data.type) || (item.type === 'artifact' && item.data.type === 'image')) && displayMode === 'Image')) && !isEditing">
          <div v-if="item.data.type === 'pdf' || item.type === 'artifact'" class="flex items-center gap-1">
            <input
              type="text"
              inputmode="numeric"
              v-model="jumpToPageInput"
              @keyup.enter="jumpToPage"
              class="w-16 p-1 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] text-sm"
              :placeholder="'1-' + (item.data.pages?.length || 0)"
            />
            <span class="text-[#e2e8f0] text-sm">of {{ item.data.pages?.length || 0 }}</span>
          </div>
          <button v-if="item.data.type === 'pdf' || item.type === 'artifact'" @click="jumpToPage" class="py-1 px-2 bg-[#3b82f6] text-white rounded-lg text-sm">Go</button>
          <div class="flex items-center">
            <div class="flex items-center">
              <button
                @click="ocrPage"
                :disabled="isOcrLoading"
                class="py-1 px-2 bg-[#3b82f6] text-white rounded-lg rounded-r-none text-sm disabled:bg-[#4b5563] hover:bg-[#2563eb] disabled:cursor-not-allowed flex items-center"
              >
                <span>OCR</span>
                <i v-if="isOcrLoading && !isOcrAllRunning" class="pi pi-spin pi-spinner ml-2"></i>
              </button>
              <button
                @click="openOcrPromptEditor"
                class="py-1 px-2 bg-[#3b82f6] text-white rounded-lg rounded-l-none text-sm hover:bg-[#2563eb] flex items-center"
              >  
                <i class="pi pi-pencil"></i>
              </button>
            </div>
            <button
              v-if="item.data.type === 'pdf' && displayMode === 'PDF' && !isOcrAllRunning"
              @click="ocrAllPages"
              :disabled="isOcrLoading"
              class="py-1 px-2 bg-[#3b82f6] text-white rounded-lg ml-2 text-sm disabled:bg-[#4b5563] hover:bg-[#2563eb] disabled:cursor-not-allowed flex items-center"
            >
              <span>OCR All</span>
            </button>
            <div v-if="isOcrAllRunning" class="flex items-center ml-2">
              <button
                class="py-1 px-2 bg-[#ef4444] text-white rounded-lg text-sm disabled:bg-[#4b5563] hover:bg-[#dc2626] flex items-center"
                @click="stopOcrAll"
              >
                <span>Stop</span>
              </button>
              <span class="text-[#e2e8f0] ml-2 text-sm">{{ ocrProgress }} of {{ item.data.pages?.length || 0 }}</span>
            </div>
          </div>
        </template>
        <h2 class="p-1 text-sm font-bold text-gray-500">{{item.data.name}}</h2>
      </div>
      <div class="flex-1 overflow-y-auto">
        <lazy-scroll-viewer
          v-if="item.data.type === 'pdf' && displayMode === 'PDF' && !isEditing"
          ref="lazyScrollViewer"
          :pages="renderedContent"
          class="pdf-viewer"
          @page-visible="handlePageVisible"
        />
        <div v-else-if="isEditing" class="p-4 h-full">
          <div v-if="item.data.type === 'docx' && displayMode === 'HTML'" class="bg-[#2d3748] p-2 rounded-lg h-full overflow-y-auto">
            <div
              v-for="(content, index) in editedContent"
              :key="index"
              contenteditable="true"
              @input="handleDocxInput(index, $event)"
              class="text-[#e2e8f0] outline-none w-full whitespace-pre-wrap"
              v-html="content"
            ></div>
          </div>
          <div v-else class="p-2 rounded-lg h-full overflow-y-none">
            <textarea
              v-for="(content, index) in editedContent"
              :key="index"
              v-model="editedContent[index]"
              @input="handleTextInput(index, $event)"
              class="text-[#e2e8f0] bg-[#2d3748] outline-none w-full h-full resize-none border-none whitespace-pre-wrap pb-5"
            ></textarea>
          </div>
        </div>
        <div v-else class="p-4 text-[#e2e8f0] whitespace-pre-wrap" v-html="renderedContent.join('<hr>')"></div>
        <div class="h-[200px]"></div>
      </div>
      <ocr-prompt-editor
        v-if="showOcrPromptEditor"
        :initial-prompt="ocrPrompt"
        @update-prompt="updateOcrPrompt"
        @reset-prompt="resetOcrPromptHandler"
        @close="closeOcrPromptEditor"
      />
    </div>
  `,
};