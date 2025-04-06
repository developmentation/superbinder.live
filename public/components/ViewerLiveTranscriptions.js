import { useLiveTranscriptions } from '../composables/useLiveTranscriptions.js';
import { useArtifacts } from '../composables/useArtifacts.js';
import SectionSelectorModal from './SectionSelectorModal.js';
import TextToSpeech from './TextToSpeech.js';

export default {
  name: 'ViewerLiveTranscriptions',
  components: { SectionSelectorModal, TextToSpeech },
  setup() {
    const { transcriptBuffer, liveTranscriptions, selectedLiveTranscription, startLiveTranscription, toggleCommandMode, selectTranscription, updateTranscription, removeTranscription, cleanup } = useLiveTranscriptions();
    const { addArtifact } = useArtifacts();
    const isRecording = Vue.ref(false);
    const isCommandMode = Vue.ref(false);
    const showArtifactModal = Vue.ref(false);
    const artifactTarget = Vue.ref(null);
    let mediaRecorder = null;
    let mediaStream = null;
    let stopTranscription = null;

    const toggleRecording = async () => {
      if (isRecording.value) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
        if (stopTranscription) stopTranscription();
        isRecording.value = false;
        mediaRecorder = null;
        mediaStream = null;
        stopTranscription = null;
      } else {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
          stopTranscription = await startLiveTranscription((sendAudioChunk) => {
            mediaRecorder.ondataavailable = (event) => sendAudioChunk(event.data);
            if (mediaRecorder.state !== 'recording') {
              mediaRecorder.start(1000);
              console.log('MediaRecorder started');
            }
          });
          isRecording.value = true;
        } catch (error) {
          console.error('Failed to start recording:', error);
          alert(`Error: ${error.message}`);
          if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
          if (stopTranscription) stopTranscription();
        }
      }
    };

    const startCommandMode = () => {
      isCommandMode.value = true;
      toggleCommandMode(true);
    };

    const endCommandMode = () => {
      isCommandMode.value = false;
      toggleCommandMode(false);
    };

    const removeTranscriptionWrapper = (transcription) => {
      removeTranscription(transcription.id);
    };

    const renderedSegments = Vue.computed(() => {
      if (!selectedLiveTranscription.value) return [];
      return selectedLiveTranscription.value.data.segments.map(segment => ({
        text: segment.text,
        segmentNumber: segment.segmentNumber,
        commandMode: segment.commandMode,
        commandActioned: segment.commandActioned,
      }));
    });

    const entireTranscriptText = Vue.computed(() => {
      if (!selectedLiveTranscription.value) return '';
      return selectedLiveTranscription.value.data.segments.map(s => s.text).join('\n');
    });

    const startEditingTranscription = (transcription) => {
      liveTranscriptions.value.forEach(t => {
        t.isEditing = false;
        t.editedName = t.data.name;
      });
      transcription.isEditing = true;
      transcription.editedName = transcription.data.name;
    };

    const finishEditingTranscription = (transcription) => {
      transcription.data.name = transcription.editedName || `Live Session ${transcription.timestamp}`;
      transcription.isEditing = false;
      liveTranscriptions.value = [...liveTranscriptions.value];
      updateTranscription(transcription);
    };

    const openArtifactModal = (target) => {
      const text = typeof target.text === 'function' ? target.text() : (target.data ? entireTranscriptTextForTranscription(target) : target.text);
      artifactTarget.value = { text };
      showArtifactModal.value = true;
      console.log('Opening artifact modal with target:', { text });
      console.log('showArtifactModal.value:', showArtifactModal.value);
    };

    const entireTranscriptTextForTranscription = (transcription) => {
      return transcription.data.segments.map(s => s.text).join('\n');
    };

    const saveArtifactFromModal = ({ sectionIds, name }) => {
      console.log('Saving artifact from modal:', { sectionIds, name });
      if (sectionIds.length > 0) {
        const timestamp = Date.now();
        sectionIds.forEach((sectionId, index) => {
          const artifactName = name || `Live Transcript Artifact ${timestamp}`;
          const finalName = sectionIds.length > 1 && index > 0 ? `${artifactName} (${index + 1})` : artifactName;
          const textToSave = artifactTarget.value.text;
          const pagesText = [textToSave];
          console.log('Saving artifact with pagesText:', pagesText);
          addArtifact(finalName, pagesText, sectionId);
        });
      }
      closeArtifactModal();
    };

    const closeArtifactModal = () => {
      console.log('Closing artifact modal');
      showArtifactModal.value = false;
      artifactTarget.value = null;
    };

    Vue.onUnmounted(() => {
      if (isRecording.value) toggleRecording();
      cleanup();
    });

    return {
      isRecording,
      isCommandMode,
      transcriptBuffer,
      liveTranscriptions,
      selectedLiveTranscription,
      showArtifactModal,
      artifactTarget,
      toggleRecording,
      startCommandMode,
      endCommandMode,
      selectTranscription,
      removeTranscription: removeTranscriptionWrapper,
      startEditingTranscription,
      finishEditingTranscription,
      renderedSegments,
      entireTranscriptText,
      openArtifactModal,
      saveArtifactFromModal,
      closeArtifactModal,
    };
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden bg-[#1a2233]">
      <!-- Top Section: Record and Command Buttons -->
      <div class="p-4 bg-[#1a2233] border-b border-[#2d3748] flex justify-center items-center gap-4">
        <button
          @click="toggleRecording"
          class="w-24 h-24 rounded-full flex items-center justify-center text-white text-lg font-bold"
          :class="isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-[#10b981] hover:bg-[#059669]'"
        >
          <i class="pi" :class="isRecording ? 'pi-stop' : 'pi-microphone'" style="font-size: 2rem;"></i>
        </button>
        <button
          @mousedown="startCommandMode"
          @mouseup="endCommandMode"
          @touchstart="startCommandMode"
          @touchend="endCommandMode"
          class="py-2 px-4 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm flex items-center"
        >
          <i class="pi pi-comment mr-2"></i>
          {{ isCommandMode ? 'Command Mode Enabled' : 'Hold for Command' }}
        </button>
      </div>

      <!-- Main Content -->
      <div class="flex flex-col md:flex-row h-full">
        <!-- Left Column: Live Transcription List -->
        <div class="w-full md:w-1/3 border-r border-[#2d3748] overflow-hidden flex flex-col">
          <div class="flex-1 overflow-y-auto">
            <div v-for="transcription in liveTranscriptions" :key="transcription.id" class="p-2 border-b border-[#2d3748]">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div
                    @click="selectTranscription(transcription)"
                    class="text-[#e2e8f0] font-semibold text-sm truncate cursor-pointer hover:bg-[#2d3748] p-1"
                    :class="{ 'bg-[#3b82f6]': selectedLiveTranscription === transcription }"
                  >
                    <span v-if="!transcription.isEditing">{{ transcription.data.name }}</span>
                    <input
                      v-else
                      v-model="transcription.editedName"
                      @click.stop
                      @blur="finishEditingTranscription(transcription)"
                      @keypress.enter="finishEditingTranscription(transcription)"
                      class="p-1 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] text-sm"
                    />
                  </div>
                  <button
                    v-if="!transcription.isEditing"
                    @click.stop="startEditingTranscription(transcription)"
                    class="ml-2 text-[#f59e0b] hover:text-[#d97706]"
                    title="Edit Transcription Name"
                  >
                    <i class="pi pi-pencil"></i>
                  </button>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click.stop="openArtifactModal(transcription)"
                    class="text-blue-400 hover:text-blue-300"
                    title="Save Entire Transcript as Artifact"
                  >
                    <i class="pi pi-bookmark"></i>
                  </button>
                  <button
                    @click.stop="removeTranscription(transcription)"
                    class="text-red-400 hover:text-red-300"
                    title="Delete Transcription"
                  >
                    <i class="pi pi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
            <div v-if="!liveTranscriptions.length" class="p-4 text-[#94a3b8] text-sm text-center">
              No live transcriptions yet.
            </div>
                 <div class="h-[200px]"></div>
          </div>
        </div>

        <!-- Right Column: Transcription Viewer -->
        <div class="w-full md:w-2/3 overflow-hidden flex flex-col">
          <div v-if="selectedLiveTranscription" class="p-2 bg-[#1a2233] border-b border-[#2d3748] sticky top-0 z-10">
            <h2 class="text-sm font-bold text-gray-500 truncate">
              {{ selectedLiveTranscription.data.name }}
            </h2>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="renderedSegments.length" class="space-y-4">
              <div
                v-for="segment in renderedSegments"
                :key="segment.segmentNumber"
                class="p-4 rounded-lg shadow-md text-[#e2e8f0]"
                :class="{
                  'bg-[#2d3748]': !segment.commandMode,
                  'bg-[#1e40af]': segment.commandMode && !segment.commandActioned,
                  'bg-[#047857]': segment.commandMode && segment.commandActioned,
                }"
              >
                <div class="text-sm whitespace-pre-wrap">{{ segment.text }}</div>
                <div class="text-xs text-[#94a3b8] mt-2">Segment {{ segment.segmentNumber }}</div>
                <div class="mt-2 flex items-center gap-2">
                  <button
                    @click.stop="openArtifactModal(segment)"
                    class="text-blue-400 hover:text-blue-300"
                    title="Save as Artifact"
                  >
                    <i class="pi pi-bookmark"></i>
                  </button>
                  <text-to-speech :text="segment.text" />
                </div>
              </div>
            </div>
            <div v-else class="h-full flex items-center justify-center text-[#94a3b8] text-sm">
              No segments available yet.
            </div>
              <div class="h-[200px]"></div>
          </div>
        </div>
      </div>

      <!-- Artifact Modal -->
      <section-selector-modal
        :visible="showArtifactModal"
        @save="saveArtifactFromModal"
        @close="closeArtifactModal"
      />
    </div>
  `,
};