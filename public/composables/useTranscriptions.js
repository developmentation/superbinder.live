import { useRealTime } from './useRealTime.js';

const transcriptions = Vue.ref([]);
const { emit, on, off, userUuid } = useRealTime();

const processedEvents = new Set();
const eventHandlers = new WeakMap();

export function useTranscriptions() {
  const SUPPORTED_EXTENSIONS = [
    '.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac',
    '.aiff', '.flac', '.caf', '.mka', '.wma',
    '.mp4', '.ogv', '.mov', '.mkv', '.avi',
    '.wmv', '.3gp', '.flv'
  ];

  // Event Handlers
  function handleAddTranscription(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-transcription-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!transcriptions.value.some((t) => t.id === id)) {
        transcriptions.value.push({ id, userUuid: eventUserUuid, data });
        transcriptions.value = [...transcriptions.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  function handleUpdateTranscription(eventObj) {
    const { id, data, timestamp } = eventObj;
    if (!id || !data || typeof data.filename !== 'string' || data.filename.trim() === '') {
      console.warn('Invalid update-transcription data:', eventObj);
      return;
    }
    const transcription = transcriptions.value.find((t) => t.id === id);
    if (transcription) {
      transcription.data = { ...transcription.data, ...data };
      transcriptions.value = [...transcriptions.value];
    }
  }

  function handleRemoveTranscription(eventObj) {
    const { id, timestamp } = eventObj;
    if (!id) {
      console.warn('Invalid remove-transcription data:', eventObj);
      return;
    }
    transcriptions.value = transcriptions.value.filter((t) => t.id !== id);
    transcriptions.value = [...transcriptions.value];
  }

  const addTranscriptionHandler = on('add-transcription', handleAddTranscription);
  const updateTranscriptionHandler = on('update-transcription', handleUpdateTranscription);
  const removeTranscriptionHandler = on('remove-transcription', handleRemoveTranscription);

  eventHandlers.set(useTranscriptions, {
    add: addTranscriptionHandler,
    update: updateTranscriptionHandler,
    remove: removeTranscriptionHandler,
  });

  const validateFile = (file) => {
    const errors = [];
    if (!file) {
      errors.push('No file selected');
      return errors;
    }

    const maxSize = 1000 * 1024 * 1024; // 1GB
    if (file.size > maxSize) {
      errors.push('File size exceeds 1GB limit');
    }

    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      errors.push('Unsupported file format. Please upload a valid audio or video file');
    }

    return errors;
  };

  const transcribeFile = async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/transcription', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        }
      });

      const id = uuidv4();
      const transcriptData = response.data.transcript;
      const payload = {
        id,
        userUuid: userUuid.value,
        data: {
          filename: file.name,
          segments: transcriptData.segments || [{ text: transcriptData.text || '', start: 0, end: 0, speaker: 'Unknown' }],
          speakers: transcriptData.speakers || [{ id: 'Unknown', displayName: 'Unknown' }],
        },
        timestamp: Date.now(),
      };

      transcriptions.value.push(payload);
      transcriptions.value = [...transcriptions.value];
      emit('add-transcription', payload);

      return {
        success: true,
        data: transcriptData,
      };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Transcription failed',
      };
    }
  };

  function updateTranscription(id, filename, transcript) {
    const transcription = transcriptions.value.find((t) => t.id === id);
    if (transcription) {
      const payload = {
        id,
        userUuid: userUuid.value,
        data: { filename: filename.trim(), segments: transcription.data.segments, speakers: transcription.data.speakers },
        timestamp: Date.now(),
      };
      transcription.data = payload.data;
      transcriptions.value = [...transcriptions.value];
      emit('update-transcription', payload);
    }
  }

  function removeTranscription(id) {
    const transcription = transcriptions.value.find((t) => t.id === id);
    if (transcription) {
      const payload = {
        id,
        userUuid: userUuid.value,
        data: null,
        timestamp: Date.now(),
      };
      transcriptions.value = transcriptions.value.filter((t) => t.id !== id);
      transcriptions.value = [...transcriptions.value];
      emit('remove-transcription', payload);
    }
  }

  function cleanup() {
    const handlers = eventHandlers.get(useTranscriptions);
    if (handlers) {
      off('add-transcription', handlers.add);
      off('update-transcription', handlers.update);
      off('remove-transcription', handlers.remove);
      eventHandlers.delete(useTranscriptions);
    }
    processedEvents.clear();
  }


  function clearTranscriptBuffer ()
  {
    
  }
  return {
    transcriptions,
    SUPPORTED_EXTENSIONS,
    validateFile,
    transcribeFile,
    updateTranscription,
    removeTranscription,
    cleanup,
    clearTranscriptBuffer 
  };
}