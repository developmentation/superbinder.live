// components/ViewerTranscription.js
import { useTranscriptions } from '../composables/useTranscriptions.js';
import { useArtifacts } from '../composables/useArtifacts.js';
import SectionSelectorModal from './SectionSelectorModal.js';
// Assuming TextToSpeech is imported by a parent component, but including it here for clarity
// Remove this import if it's handled elsewhere
import TextToSpeech from './TextToSpeech.js';

export default {
  name: 'ViewerTranscriptions',
  components: { SectionSelectorModal, TextToSpeech },
  setup() {
    const { transcribeFile, SUPPORTED_EXTENSIONS, startLiveTranscription, clearTranscriptBuffer, getLiveTranscript, transcriptBuffer } = useTranscriptions();
    const { addArtifact } = useArtifacts();
    const transcripts = Vue.ref([]);
    const selectedTranscript = Vue.ref(null);
    const selectedSection = Vue.ref(null);
    const fileInput = Vue.ref(null);
    const uploadProgress = Vue.ref(0);
    const isUploading = Vue.ref(false);
    const showArtifactModal = Vue.ref(false);
    const artifactTarget = Vue.ref(null);
    const isRecording = Vue.ref(false);
    let stopLiveTranscription = null;
    let liveTranscriptEntry = null; // Store the live transcript entry

    // Example channel data (adjust as per your app's logic)
    const userUuid = 'user-123'; // Replace with actual user UUID
    const displayName = 'User Name'; // Replace with actual display name
    const channelName = 'transcription-channel'; // Replace with actual channel name

    const handleFileUpload = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const errors = validateFile(file);
      if (errors.length) {
        alert(errors.join('\n'));
        return;
      }

      isUploading.value = true;
      uploadProgress.value = 0;

      const result = await transcribeFile(file, (progress) => {
        uploadProgress.value = progress;
      });

      isUploading.value = false;
      if (result.success) {
        const transcript = {
          filename: file.name,
          data: {
            ...result.data,
            speakers: result.data.speakers.map(speaker => ({
              ...speaker,
              isEditing: false,
              editedName: speaker.displayName,
            })),
          },
        };
        transcripts.value.push(transcript);
        selectTranscript(transcripts.value[transcripts.value.length - 1]);
      } else {
        alert(`Transcription failed: ${result.error}`);
      }
      fileInput.value.value = '';
    };

    const validateFile = (file) => {
      const errors = [];
      const maxSize = 1000 * 1024 * 1024;
      if (file.size > maxSize) errors.push('File size exceeds 1GB limit');
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) errors.push('Unsupported file format');
      return errors;
    };

    const toggleLiveTranscription = async () => {
      if (isRecording.value) {
        stopLiveTranscription?.();
        isRecording.value = false;
        // Add the live transcript to the transcripts list
        if (transcriptBuffer.value.length > 0) {
          const liveTranscript = getLiveTranscript();
          transcripts.value.push(liveTranscript);
          liveTranscriptEntry = liveTranscript; // Store the entry for reference
        }
      } else {
        clearTranscriptBuffer(); // Clear previous live transcript data
        liveTranscriptEntry = null; // Reset the live transcript entry
        isRecording.value = true;
        stopLiveTranscription = await startLiveTranscription((concatenatedTranscript) => {
          // The buffer is already updated in useTranscriptions.js via transcriptBuffer
          // No need to update here since we're using the reactive transcriptBuffer directly
        });
      }
    };

    const selectTranscript = (transcript) => {
      if (selectedTranscript.value !== transcript) {
        transcripts.value.forEach(t => {
          t.data.speakers.forEach(s => {
            s.isEditing = false;
            s.editedName = s.displayName;
          });
        });
      }
      selectedTranscript.value = transcript;
      selectedSection.value = 'entire';
      if (transcript !== liveTranscriptEntry) {
        clearTranscriptBuffer(); // Clear live transcript buffer when selecting a file transcript
      }
    };

    const selectSection = (section) => {
      selectedSection.value = section;
    };

    const startEditingSpeaker = (transcript, speakerId) => {
      const speaker = transcript.data.speakers.find(s => s.id === speakerId);
      if (speaker) {
        transcripts.value.forEach(t => {
          t.data.speakers.forEach(s => {
            s.isEditing = false;
            s.editedName = s.displayName;
          });
        });
        speaker.isEditing = true;
        speaker.editedName = speaker.displayName;
      }
    };

    const finishEditingSpeaker = (transcript, speakerId) => {
      const speaker = transcript.data.speakers.find(s => s.id === speakerId);
      if (speaker) {
        speaker.displayName = speaker.editedName || speaker.displayName;
        speaker.isEditing = false;
        transcript.data = { ...transcript.data };
      }
    };

    const formatTime = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
    };

    const renderedTranscript = Vue.computed(() => {
      if (selectedTranscript.value === liveTranscriptEntry && transcriptBuffer.value.length > 0) {
        // Display the concatenated live transcript
        const concatenatedText = transcriptBuffer.value.map(segment => segment.text).join(' ');
        return [{
          text: concatenatedText,
          timestamp: 'Live',
          speaker: 'You'
        }];
      }
      if (!selectedTranscript.value) return [];
      const transcript = selectedTranscript.value.data;
      const segments = transcript.segments || [];

      if (selectedSection.value === 'entire') {
        return segments.map(segment => ({
          text: segment.text,
          timestamp: `${formatTime(segment.start)} - ${formatTime(segment.end)}`,
          speaker: transcript.speakers.find(s => s.id === segment.speaker)?.displayName || `Speaker ${segment.speaker}`,
        }));
      } else {
        const speakerId = Number(selectedSection.value);
        const speakerSegments = segments.filter(s => s.speaker === speakerId);
        return speakerSegments.map(segment => ({
          text: segment.text,
          timestamp: `${formatTime(segment.start)} - ${formatTime(segment.end)}`,
          speaker: transcript.speakers.find(s => s.id === segment.speaker)?.displayName || `Speaker ${segment.speaker}`,
        }));
      }
    });

    const entireTranscriptText = Vue.computed(() => {
      if (!selectedTranscript.value) return '';
      const segments = selectedTranscript.value.data.segments || [];
      return segments.map(s => s.text).join('\n');
    });

    const getSpeakerTranscriptText = (speakerId) => {
      if (!selectedTranscript.value) return '';
      const segments = selectedTranscript.value.data.segments || [];
      return segments
        .filter(s => s.speaker === Number(speakerId))
        .map(s => s.text)
        .join('\n');
    };

    const openArtifactModal = (target) => {
      artifactTarget.value = target;
      showArtifactModal.value = true;
    };

    const saveArtifactFromModal = ({ sectionIds, name }) => {
      if (sectionIds.length > 0) {
        const timestamp = Date.now();
        sectionIds.forEach((sectionId, index) => {
          const artifactName = name || `Transcript Artifact ${timestamp}`;
          const finalName = sectionIds.length > 1 && index > 0 ? `${artifactName} (${index + 1})` : artifactName;
          const pagesText = [artifactTarget.value.text];
          console.log('Saving artifact:', { name: finalName, text: pagesText, sectionId });
          addArtifact(finalName, pagesText, sectionId);
        });
      }
      closeArtifactModal();
    };

    const closeArtifactModal = () => {
      showArtifactModal.value = false;
      artifactTarget.value = null;
    };

    return {
      transcripts,
      selectedTranscript,
      selectedSection,
      fileInput,
      uploadProgress,
      isUploading,
      showArtifactModal,
      artifactTarget,
      isRecording,
      transcriptBuffer, // Expose for debugging if needed
      handleFileUpload,
      selectTranscript,
      selectSection,
      startEditingSpeaker,
      finishEditingSpeaker,
      renderedTranscript,
      entireTranscriptText,
      getSpeakerTranscriptText,
      openArtifactModal,
      saveArtifactFromModal,
      closeArtifactModal,
      toggleLiveTranscription,
    };
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden bg-[#1a2233]">
      <div class="flex flex-col md:flex-row h-full">
        <!-- Left Column: Transcript List -->
        <div class="w-full md:w-1/3 border-r border-[#2d3748] overflow-hidden flex flex-col">
          <div class="p-2 bg-[#1a2233] border-b border-[#2d3748] sticky top-0 z-10 flex items-center gap-2">
            <input
              type="file"
              ref="fileInput"
              @change="handleFileUpload"
              class="hidden"
            />
            <button
              @click="$refs.fileInput.click()"
              class="py-1 px-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-sm flex items-center"
              :disabled="isUploading || isRecording"
              title="Upload File"
            >
              <i class="pi pi-upload"></i>
              <span v-if="isUploading" class="ml-1">Uploading ({{ uploadProgress }}%)</span>
              <span v-else class="ml-1">Upload</span>
            </button>
            <button
              @click="toggleLiveTranscription"
              class="py-1 px-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm flex items-center"
              :disabled="isUploading"
              title="Toggle Microphone"
            >
              <i class="pi" :class="isRecording ? 'pi-microphone-off' : 'pi-microphone'"></i>
              <span class="ml-1">{{ isRecording ? 'Stop' : 'Start' }} Live</span>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto">
            <div v-for="transcript in transcripts" :key="transcript.filename" class="p-2 border-b border-[#2d3748]">
              <div class="text-[#e2e8f0] font-semibold text-sm truncate">{{ transcript.filename }}</div>
              <div
                @click="selectTranscript(transcript); selectSection('entire')"
                class="p-1 text-[#e2e8f0] cursor-pointer hover:bg-[#2d3748] flex items-center justify-between"
                :class="{ 'bg-[#3b82f6]': selectedTranscript === transcript && selectedSection === 'entire' }"
              >
                <span class="text-sm">Entire Transcript</span>
                <button
                  @click.stop="openArtifactModal({ text: entireTranscriptText })"
                  class="text-blue-400 hover:text-blue-300"
                  title="Save as Artifact"
                >
                  <i class="pi pi-bookmark"></i>
                </button>
              </div>
              <div
                v-for="speaker in transcript.data.speakers"
                :key="speaker.id"
                @click="selectTranscript(transcript); selectSection(speaker.id)"
                class="p-1 text-[#e2e8f0] cursor-pointer hover:bg-[#2d3748] flex items-center justify-between"
                :class="{ 'bg-[#3b82f6]': selectedTranscript === transcript && Number(selectedSection) === speaker.id }"
              >
                <div class="flex items-center">
                  <span v-if="!speaker.isEditing" class="text-sm">{{ speaker.displayName }}</span>
                  <input
                    v-else
                    v-model="speaker.editedName"
                    @click.stop
                    @blur="finishEditingSpeaker(transcript, speaker.id)"
                    @keypress.enter="finishEditingSpeaker(transcript, speaker.id)"
                    class="p-1 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] text-sm"
                  />
                  <button
                    v-if="!speaker.isEditing"
                    @click.stop="startEditingSpeaker(transcript, speaker.id)"
                    class="ml-2 text-[#f59e0b] hover:text-[#d97706]"
                    title="Edit Speaker Name"
                  >
                    <i class="pi pi-pencil"></i>
                  </button>
                </div>
                <button
                  @click.stop="openArtifactModal({ text: getSpeakerTranscriptText(speaker.id) })"
                  class="text-blue-400 hover:text-blue-300"
                  title="Save as Artifact"
                >
                  <i class="pi pi-bookmark"></i>
                </button>
              </div>
            </div>
            <div v-if="!transcripts.length" class="p-4 text-[#94a3b8] text-sm text-center">
              No transcripts uploaded yet.
            </div>
          </div>
        </div>

        <!-- Right Column: Transcript Viewer (Card-Based) -->
        <div class="w-full md:w-2/3 overflow-hidden flex flex-col">
          <div v-if="selectedTranscript || transcriptBuffer.length > 0" class="p-2 bg-[#1a2233] border-b border-[#2d3748] sticky top-0 z-10">
            <h2 class="text-sm font-bold text-gray-500 truncate">
              {{ transcriptBuffer.length > 0 && selectedTranscript === liveTranscriptEntry ? 'Live Transcription' : (selectedSection === 'entire' ? 'Entire Transcript' : selectedTranscript?.data.speakers.find(s => s.id === Number(selectedSection))?.displayName) }}
            </h2>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="renderedTranscript.length" class="space-y-4">
              <div
                v-for="segment in renderedTranscript"
                :key="segment.id || segment.text"
                class="p-4 bg-[#2d3748] rounded-lg shadow-md text-[#e2e8f0]"
              >
                <div class="text-sm whitespace-pre-wrap">{{ segment.text }}</div>
                <div class="text-xs text-[#94a3b8] mt-2">{{ segment.timestamp }} ({{ segment.speaker }})</div>
                <div class="mt-2 flex items-center gap-2">
                  <button
                    @click="openArtifactModal(segment)"
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
              No segments available for this selection.
            </div>
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