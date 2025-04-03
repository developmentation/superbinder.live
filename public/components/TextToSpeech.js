// TextToSpeech.vue
import { useTextToSpeech } from '../composables/useTextToSpeech.js';

export default {
  name: "TextToSpeech",
  props: {
    text: { type: String, required: true },
  },
  template: `
    <div class="tts-component flex items-center gap-2">
      <audio ref="audioElement" @play="onPlay" @pause="onPause" @ended="onEnded" @error="onError" style="display: none;"></audio>
      <div class="controls flex gap-2">
        <i 
          v-if="!isPlaying && !isLoading" 
          @click="playAudio" 
          class="pi pi-play-circle text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
          :class="{ 'opacity-50 cursor-not-allowed': isLoading }"
        ></i>
        <svg 
          v-if="isLoading" 
          class="animate-spin h-4 w-4 text-gray-400"
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <i 
          v-if="isPlaying && !isPaused" 
          @click="pauseAudio" 
          class="pi pi-pause-circle text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
        ></i>
        <i 
          v-if="isPlaying && isPaused" 
          @click="resumeAudio" 
          class="pi pi-play-circle text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
        ></i>
        <i 
          v-if="isPlaying" 
          @click="stopAudio" 
          class="pi pi-stop-circle text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
        ></i>
      </div>
      <div class="voice-selector relative flex items-center gap-2">
        <div 
          @click="isDropdownOpen = !isDropdownOpen" 
          class="dropdown-btn w-6 h-6 flex items-center justify-center bg-gray-700 border border-gray-600 rounded-md text-gray-200 text-sm cursor-pointer"
        >
          <span :class="{ 'rotate-180': isDropdownOpen }" class="carat transition-transform text-sm">▼</span>
        </div>
        <div 
          v-if="isDropdownOpen" 
          class="dropdown-menu absolute top-full left-0 w-48 bg-gray-700 border border-gray-600 rounded-md max-h-40 overflow-y-auto z-10"
        >
          <div 
            v-for="voice in ttsVoices" 
            :key="voice.id" 
            @click="selectVoice(voice)"
            class="dropdown-item p-2 text-sm text-gray-200 cursor-pointer hover:bg-gray-600"
          >
            {{ voice.name }} ({{ voice.language }})
          </div>
        </div>
        <i 
          v-if="canDownload" 
          @click="downloadAudio" 
          class="pi pi-download text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
          title="Download Audio"
        ></i>
      </div>
    </div>
  `,
  setup(props) {
    const isPlaying = Vue.ref(false);
    const isPaused = Vue.ref(false);
    const isLoading = Vue.ref(false);
    const selectedVoice = Vue.ref('');
    const isDropdownOpen = Vue.ref(false);
    const audioElement = Vue.ref(null);
    const mediaSource = Vue.ref(null);
    const sourceBuffer = Vue.ref(null);
    const audioChunks = Vue.ref([]);
    const canDownload = Vue.ref(false);
    const chunkQueue = Vue.ref([]);
    let isFetching = false;
    let isAppending = false;

    const { ttsVoices, generateAudioStream } = useTextToSpeech();

    const resetState = () => {
      if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value.currentTime = 0;
      }
      if (mediaSource.value && mediaSource.value.readyState === 'open') {
        mediaSource.value.endOfStream();
      }
      isPlaying.value = false;
      isPaused.value = false;
      isLoading.value = false;
      audioChunks.value = [];
      chunkQueue.value = [];
      isDropdownOpen.value = false;
      canDownload.value = false;
      isFetching = false;
      isAppending = false;
      mediaSource.value = null;
      sourceBuffer.value = null;
    };

    Vue.watch(() => props.text, (newText, oldText) => {
      if (newText !== oldText) {
        resetState();
      }
    }, { immediate: true });

    const appendNextChunk = () => {
      if (!sourceBuffer.value || isAppending || !chunkQueue.value.length) return;

      isAppending = true;
      const chunk = chunkQueue.value.shift();
      
      try {
        sourceBuffer.value.appendBuffer(chunk);
      } catch (error) {
        console.error('Error appending buffer:', error);
        isAppending = false;
      }
    };

    const playAudio = async () => {
      if (isPlaying.value && !isPaused.value) return;
      if (isFetching) return;

      isLoading.value = true;
      isFetching = true;

      try {
        const result = await generateAudioStream(props.text, selectedVoice.value);
        if (!result.success) throw new Error(result.error);

        mediaSource.value = new MediaSource();
        audioElement.value.src = URL.createObjectURL(mediaSource.value);

        mediaSource.value.addEventListener('sourceopen', async () => {
          sourceBuffer.value = mediaSource.value.addSourceBuffer('audio/mpeg');
          const reader = result.stream.getReader();
          
          audioChunks.value = [];
          chunkQueue.value = [];

          sourceBuffer.value.addEventListener('updateend', () => {
            isAppending = false;
            if (!isPlaying.value && audioElement.value.paused && mediaSource.value.readyState === 'open') {
              audioElement.value.play();
            }
            appendNextChunk();
          });

          sourceBuffer.value.addEventListener('error', (e) => {
            console.error('SourceBuffer error:', e);
          });

          const processStream = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                if (mediaSource.value.readyState === 'open') {
                  mediaSource.value.endOfStream();
                }
                canDownload.value = true;
                break;
              }

              audioChunks.value.push(value);
              chunkQueue.value.push(value);

              if (!isAppending && sourceBuffer.value && !sourceBuffer.value.updating) {
                appendNextChunk();
              }
            }
          };

          await processStream();
        });

      } catch (error) {
        console.error('Error generating audio:', error);
        resetState();
      } finally {
        isLoading.value = false;
        isFetching = false;
      }
    };

    const pauseAudio = () => {
      if (isPlaying.value) {
        audioElement.value.pause();
      }
    };

    const resumeAudio = () => {
      if (isPaused.value) {
        audioElement.value.play();
      }
    };

    const stopAudio = () => {
      resetState();
    };

    const selectVoice = (voice) => {
      selectedVoice.value = voice.path;
      isDropdownOpen.value = false;
      resetState();
    };

    const downloadAudio = () => {
      if (!canDownload.value || !audioChunks.value.length) return;
      const blob = new Blob(audioChunks.value, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-audio.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const onPlay = () => {
      isPlaying.value = true;
      isPaused.value = false;
      isLoading.value = false;
      console.log('Audio playback started');
    };

    const onPause = () => {
      isPaused.value = true;
      isPlaying.value = false;
      console.log('Audio paused');
    };

    const onEnded = () => {
      isPlaying.value = false;
      isPaused.value = false;
      console.log('Audio playback ended');
    };

    const onError = (error) => {
      console.error('Error playing audio:', error);
      resetState();
    };

    Vue.onUnmounted(() => {
      resetState();
    });

    return {
      ttsVoices,
      isPlaying,
      isPaused,
      isLoading,
      selectedVoice,
      isDropdownOpen,
      audioElement,
      canDownload,
      playAudio,
      pauseAudio,
      resumeAudio,
      stopAudio,
      selectVoice,
      downloadAudio,
      onPlay,
      onPause,
      onEnded,
      onError,
    };
  },
};