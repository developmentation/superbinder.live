import { useRealTime } from './useRealTime.js';

const transcriptBuffer = Vue.ref([]); // Store raw JSON responses
let liveTranscriptions = Vue.ref([])
// Singleton instance to prevent multiple registrations
let instance = null;

export function useLiveTranscriptions() {
  // Return the singleton instance if it exists
  if (instance) {
    return instance;
  }

  let isTranscriptionActive = false;
  let isTranscriptionReady = false;
  let onAudioChunkCallback = null;
  const { emit, on, off, userUuid, channelName } = useRealTime();

  // Store event handlers to ensure single registration
  let eventHandlersRegistered = false;
  let timeout = null; // Store the timeout reference

  const sendAudioChunk = (chunk) => {
    if (chunk.size > 0 && isTranscriptionReady) {
      console.log(`Sending audio chunk of size ${chunk.size} bytes`);
      emit('audio-chunk', { chunk });
    } else {
      console.warn('Audio chunk ignored:', { isTranscriptionReady, chunkSize: chunk.size });
    }
  };

  const handleTranscriptionReady = (eventObj) => {
    console.log('Received transcription-ready event:', eventObj);
    isTranscriptionReady = true;
    // Clear the timeout since we received transcription-ready
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (onAudioChunkCallback) {
      console.log('Transcription ready, starting audio recording');
      onAudioChunkCallback(sendAudioChunk);
    }
  };

  const handleLiveTranscript = (eventObj) => {
    if (!isTranscriptionActive) return;
    console.log('Received live-transcript event:', eventObj);
    transcriptBuffer.value.push(eventObj);
    transcriptBuffer.value = [...transcriptBuffer.value];
  };

  const handleError = (eventObj) => {
    console.error('Server error:', eventObj.message, 'Timestamp:', eventObj.timestamp);
    transcriptBuffer.value.push(eventObj);
    transcriptBuffer.value = [...transcriptBuffer.value];
  };

  // Register event handlers only once
  if (!eventHandlersRegistered) {
    console.log('Registering event handlers');
    on('transcription-ready', handleTranscriptionReady);
    on('live-transcript', handleLiveTranscript);
    on('error', handleError);
    eventHandlersRegistered = true;
  }

  const startLiveTranscription = async (onAudioChunk) => {
    if (!userUuid.value || !channelName.value) {
      throw new Error('userUuid and channelName are required');
    }

    if (isTranscriptionActive) {
      console.warn('Transcription already active, ignoring start request');
      return () => {};
    }

    isTranscriptionActive = true;
    isTranscriptionReady = false;
    onAudioChunkCallback = (sendAudioChunk) => {
      // Guard against restarting MediaRecorder if already active
      if (onAudioChunk.state === 'recording') {
        console.log('MediaRecorder already recording, skipping start');
        return;
      }
      onAudioChunk(sendAudioChunk);
    };
    transcriptBuffer.value = [];

    const transcriptionId = uuidv4();
    const payload = {
      id: transcriptionId,
      userUuid: userUuid.value,
      channelName: channelName.value,
      data: { status: 'starting' },
      timestamp: Date.now(),
    };
    console.log('Emitting start-transcription:', payload);
    emit('start-transcription', payload);

    // Set a timeout as a fallback
    timeout = setTimeout(() => {
      console.warn('Transcription ready timeout after 5s');
      isTranscriptionReady = true;
      if (onAudioChunkCallback) {
        onAudioChunkCallback(sendAudioChunk);
      }
    }, 5000);

    return () => {
      console.log('Stopping live transcription');
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      emit('stop-transcription', { id: transcriptionId, userUuid: userUuid.value });
      isTranscriptionActive = false;
      isTranscriptionReady = false;
      onAudioChunkCallback = null;
    };
  };

  const cleanup = () => {
    console.log('Cleaning up useLiveTranscriptions');
    off('transcription-ready', handleTranscriptionReady);
    off('live-transcript', handleLiveTranscript);
    off('error', handleError);
    eventHandlersRegistered = false;
    transcriptBuffer.value = [];
    isTranscriptionActive = false;
    isTranscriptionReady = false;
    onAudioChunkCallback = null;
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  // Create the instance to return
  instance = {
    liveTranscriptions,
    transcriptBuffer,
    startLiveTranscription,
    cleanup,
  };

  return instance;
}