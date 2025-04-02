import { useTextToSpeech } from '../composables/useTextToSpeech.js';

export default {
  name: "TextToSpeech",
  props: {
    text: { type: String, required: true },
  },
  template: `
    <div class="tts-component flex items-center gap-2">
      <!-- Play/Pause/Stop Controls -->
      <div class="controls flex gap-2">
        <i 
          v-if="!isPlaying && !isLoading" 
          @click="playAudio" 
          class="pi pi-play-circle text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
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

      <!-- Voice Selection Dropdown and Download Icon -->
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
          v-if="audio" 
          @click="downloadAudio" 
          class="pi pi-download text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
          title="Download Audio"
        ></i>
      </div>
    </div>
  `,
  setup(props) {
    // State
    const audio = Vue.ref(null);
    const audioBlob = Vue.ref(null);
    const isPlaying = Vue.ref(false);
    const isPaused = Vue.ref(false);
    const isLoading = Vue.ref(false);
    const selectedVoice = Vue.ref('');
    const isDropdownOpen = Vue.ref(false);
    const currentTime = Vue.ref(0);

    // Text-to-Speech composable
    const { ttsVoices, generateAudio } = useTextToSpeech();

    // Computed property to display the selected voice name (not used in template)
    const selectedVoiceName = Vue.computed(() => {
      const voice = ttsVoices.value.find(v => v.path === selectedVoice.value);
      return voice ? voice.name : '';
    });

    // Reset state function
    const resetState = () => {
      if (audio.value) {
        audio.value.pause();
        URL.revokeObjectURL(audio.value.src);
        audio.value = null;
      }
      if (audioBlob.value) {
        URL.revokeObjectURL(URL.createObjectURL(audioBlob.value));
        audioBlob.value = null;
      }
      isPlaying.value = false;
      isPaused.value = false;
      isLoading.value = false;
      currentTime.value = 0;
      // Optionally reset selectedVoice if you want to force re-selection
      // selectedVoice.value = '';
      isDropdownOpen.value = false;
    };

    // Watch for changes in the text prop
    Vue.watch(
      () => props.text,
      (newText, oldText) => {
        if (newText !== oldText) {
          console.log('Text prop changed, resetting TextToSpeech state');
          resetState();
        }
      },
      { immediate: true }
    );

    // Methods
    const playAudio = async () => {
  

      if (!audio.value) {
        try {
          isLoading.value = true;
          const result = await generateAudio(props.text, selectedVoice.value);
          if (result.success) {
            const blob = new Blob([result.data], { type: 'audio/mp3' });
            audioBlob.value = blob;
            audio.value = new Audio(URL.createObjectURL(blob));
            audio.value.ontimeupdate = () => {
              currentTime.value = audio.value.currentTime;
            };
            audio.value.onended = () => {
              isPlaying.value = false;
              isPaused.value = false;
              currentTime.value = 0;
            };
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          console.error('Error generating audio:', error);
          isLoading.value = false;
          return;
        } finally {
          isLoading.value = false;
        }
      }

      audio.value.currentTime = currentTime.value;
      audio.value.play();
      isPlaying.value = true;
      isPaused.value = false;
    };

    const pauseAudio = () => {
      if (audio.value) {
        audio.value.pause();
        isPaused.value = true;
      }
    };

    const resumeAudio = () => {
      if (audio.value) {
        audio.value.play();
        isPaused.value = false;
      }
    };

    const stopAudio = () => {
      if (audio.value) {
        audio.value.pause();
        audio.value.currentTime = 0;
        isPlaying.value = false;
        isPaused.value = false;
        currentTime.value = 0;
      }
    };

    const selectVoice = (voice) => {
      selectedVoice.value = voice.path;
      isDropdownOpen.value = false;
      // Reset audio if voice changes
      if (audio.value) {
        audio.value.pause();
        URL.revokeObjectURL(audio.value.src);
        audio.value = null;
        audioBlob.value = null;
        isPlaying.value = false;
        isPaused.value = false;
        currentTime.value = 0;
      }
    };

    const downloadAudio = () => {
      if (!audioBlob.value) return;

      const url = URL.createObjectURL(audioBlob.value);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-audio.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    // Lifecycle: Cleanup on unmount
    Vue.onUnmounted(() => {
      resetState();
    });

    return {
      ttsVoices,
      audio,
      audioBlob,
      isPlaying,
      isPaused,
      isLoading,
      selectedVoice,
      selectedVoiceName,
      isDropdownOpen,
      currentTime,
      playAudio,
      pauseAudio,
      resumeAudio,
      stopAudio,
      selectVoice,
      downloadAudio,
    };
  },
};