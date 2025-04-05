import { useLiveTranscriptions } from '../composables/useLiveTranscriptions.js';

export default {
  name: 'ViewerLiveTranscriptions',
  setup() {
    const { transcriptBuffer, startLiveTranscription, cleanup } = useLiveTranscriptions();
    const isRecording = Vue.ref(false);
    let mediaRecorder = null;
    let mediaStream = null;
    let stopTranscription = null;

    const toggleRecording = async () => {
      if (isRecording.value) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
        }
        if (stopTranscription) {
          stopTranscription();
        }
        isRecording.value = false;
        mediaRecorder = null;
        mediaStream = null;
        stopTranscription = null;
      } else {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });

          stopTranscription = await startLiveTranscription((sendAudioChunk) => {
            // Pass the MediaRecorder instance to check its state
            mediaRecorder.ondataavailable = (event) => {
              sendAudioChunk(event.data);
            };
            if (mediaRecorder.state !== 'recording') {
              mediaRecorder.start(1000);
              console.log('MediaRecorder started');
            } else {
              console.log('MediaRecorder already recording, skipping start');
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

    Vue.onUnmounted(() => {
      if (isRecording.value) toggleRecording();
      cleanup();
    });

    return {
      isRecording,
      transcriptBuffer,
      toggleRecording,
    };
  },
  template: `
    <div>
      <button
        @click="toggleRecording"
        :disabled="isRecording && !transcriptBuffer.length"
      >
        {{ isRecording ? 'Stop Recording' : 'Start Recording' }}
      </button>
      <div>
        <h3>Live Transcription Output:</h3>
        <pre v-if="transcriptBuffer.length">
          {{ JSON.stringify(transcriptBuffer, null, 2) }}
        </pre>
        <p v-else>No transcription data received yet.</p>
      </div>
    </div>
  `,
};