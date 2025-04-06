import { useRealTime } from './useRealTime.js';

const transcriptBuffer = Vue.ref([]); // Raw JSON responses
const liveTranscriptions = Vue.ref([]); // Structured transcriptions
const selectedLiveTranscription = Vue.ref(null); // Track the selected transcription
let instance = null;

export function useLiveTranscriptions() {
  if (instance) return instance;

  let isTranscriptionActive = false;
  let isTranscriptionReady = false;
  let isCommandMode = false;
  let onAudioChunkCallback = null;
  let chunkCountSinceLastTranscript = 0;
  const { emit, on, off, userUuid, channelName } = useRealTime();

  let eventHandlersRegistered = false;
  let timeout = null;

  const sendAudioChunk = (chunk) => {
    if (chunk.size > 0 && isTranscriptionReady) {
      console.log(`Sending audio chunk of size ${chunk.size} bytes`);
      emit('audio-chunk', { chunk });
      chunkCountSinceLastTranscript++;
    } else {
      console.warn('Audio chunk ignored:', { isTranscriptionReady, chunkSize: chunk.size });
    }
  };

  const handleTranscriptionReady = (eventObj) => {
    console.log('Received transcription-ready event:', eventObj);
    isTranscriptionReady = true;
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

    const { id, userUuid, data, timestamp } = eventObj;
    let transcription = liveTranscriptions.value.find(t => t.id === id);
    if (!transcription) {
      transcription = {
        id,
        channel: channelName.value,
        userUuid,
        data: { segments: [] },
        timestamp: Date.now(),
      };
      liveTranscriptions.value.push(transcription);
      selectedLiveTranscription.value = transcription; // Auto-select new transcription
      emit('add-liveTranscription', transcription);
    }

    const segmentText = data.transcript || '';
    if (segmentText.trim()) {
      if (chunkCountSinceLastTranscript > 5 || transcription.data.segments.length === 0) {
        transcription.data.segments.push({
          text: segmentText,
          commandMode: isCommandMode,
          commandActioned: false,
          segmentNumber: transcription.data.segments.length + 1,
        });
      } else {
        const lastSegment = transcription.data.segments[transcription.data.segments.length - 1];
        lastSegment.text += ' ' + segmentText;
      }
      chunkCountSinceLastTranscript = 0;
      emit('update-liveTranscription', {
        id,
        channel: channelName.value,
        userUuid,
        data: transcription.data,
        timestamp: Date.now(),
      });
    }
    liveTranscriptions.value = [...liveTranscriptions.value];
  };

  const handleError = (eventObj) => {
    console.error('Server error:', eventObj.message, 'Timestamp:', eventObj.timestamp);
    transcriptBuffer.value.push(eventObj);
  };

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
      console.warn('Transcription already active');
      return () => {};
    }

    isTranscriptionActive = true;
    isTranscriptionReady = false;
    onAudioChunkCallback = onAudioChunk;
    transcriptBuffer.value = [];
    chunkCountSinceLastTranscript = 0;

    const transcriptionId = uuidv4();
    const payload = {
      id: transcriptionId,
      channel: channelName.value,
      userUuid: userUuid.value,
      data: { segments: [] },
      timestamp: Date.now(),
    };
    liveTranscriptions.value.push(payload);
    selectedLiveTranscription.value = payload; // Auto-select new transcription
    emit('add-liveTranscription', payload);
    emit('start-transcription', payload);

    timeout = setTimeout(() => {
      console.warn('Transcription ready timeout after 5s');
      isTranscriptionReady = true;
      if (onAudioChunkCallback) onAudioChunkCallback(sendAudioChunk);
    }, 5000);

    return () => {
      console.log('Stopping live transcription');
      if (timeout) clearTimeout(timeout);
      emit('stop-transcription', { id: transcriptionId, userUuid: userUuid.value });
      isTranscriptionActive = false;
      isTranscriptionReady = false;
      onAudioChunkCallback = null;
    };
  };

  const toggleCommandMode = (enabled) => {
    isCommandMode = enabled;
    console.log(`Command Mode ${enabled ? 'Enabled' : 'Disabled'}`);
  };

  const selectTranscription = (transcription) => {
    selectedLiveTranscription.value = transcription;
  };

  const removeTranscription = (id) => {
    liveTranscriptions.value = liveTranscriptions.value.filter(t => t.id !== id);
    if (selectedLiveTranscription.value && selectedLiveTranscription.value.id === id) {
      selectedLiveTranscription.value = liveTranscriptions.value.length > 0 ? liveTranscriptions.value[liveTranscriptions.value.length - 1] : null;
    }
    emit('remove-liveTranscription', { id, userUuid: userUuid.value, timestamp: Date.now() });
  };

  const cleanup = () => {
    console.log('Cleaning up useLiveTranscriptions');
    off('transcription-ready', handleTranscriptionReady);
    off('live-transcript', handleLiveTranscript);
    off('error', handleError);
    eventHandlersRegistered = false;
    transcriptBuffer.value = [];
    liveTranscriptions.value = [];
    selectedLiveTranscription.value = null;
    isTranscriptionActive = false;
    isTranscriptionReady = false;
    onAudioChunkCallback = null;
    if (timeout) clearTimeout(timeout);
  };

  instance = {
    transcriptBuffer,
    liveTranscriptions,
    selectedLiveTranscription,
    startLiveTranscription,
    toggleCommandMode,
    selectTranscription,
    removeTranscription,
    cleanup,
  };
  return instance;
}