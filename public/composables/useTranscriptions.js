import { useRealTime } from './useRealTime.js';

let transcriptions = Vue.ref([])
let liveTranscriptions = Vue.ref([])

export const useTranscriptions = () => {
  const SUPPORTED_EXTENSIONS = [
    '.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac', 
    '.aiff', '.flac', '.caf', '.mka', '.wma',
    '.mp4', '.ogv', '.mov', '.mkv', '.avi', 
    '.wmv', '.3gp', '.flv'
  ];

  const { emit, on, off, userUuid, channelName } = useRealTime();
  const processedEvents = new Set();
  const eventHandlers = new WeakMap();
  const transcriptBuffer = Vue.ref([]); // Buffer to store all transcript segments with UUIDs
  let concatenatedTranscript = ''; // Store the concatenated transcript text

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

      return {
        success: true,
        data: response.data.transcript
      };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Transcription failed'
      };
    }
  };

  const startLiveTranscription = async (onTranscript) => {
    if (!userUuid.value || !channelName.value) {
      throw new Error('userUuid and channelName are required for live transcription');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    let isTranscriptionReady = false;
    concatenatedTranscript = ''; // Reset concatenated transcript at the start

    const handleTranscriptionReady = (eventObj) => {
      console.log('Transcription ready, starting media recorder');
      isTranscriptionReady = true;
      mediaRecorder.start(500);
    };

    const handleLiveTranscript = (eventObj) => {
      const { data, timestamp } = eventObj;
      if (data && data.transcript) {
        const eventKey = `live-transcript-${timestamp}-${uuidv4()}`; // Use UUID to ensure uniqueness
        if (!processedEvents.has(eventKey)) {
          processedEvents.add(eventKey);
          const transcriptSegment = {
            id: uuidv4(), // Assign a UUID to each transcript segment
            text: data.transcript,
            timestamp: new Date(timestamp).toISOString()
          };
          transcriptBuffer.value.push(transcriptSegment); // Add to buffer
          concatenatedTranscript += (concatenatedTranscript ? ' ' : '') + data.transcript; // Concatenate with a space
          onTranscript(concatenatedTranscript); // Pass the concatenated transcript to the callback
          setTimeout(() => processedEvents.delete(eventKey), 1000);
        }
      }
    };

    const handleError = (eventObj) => {
      const { message, timestamp } = eventObj;
      console.error('Server error:', message);
    };

    // Register event handlers
    const transcriptionReadyHandler = on('transcription-ready', handleTranscriptionReady);
    const liveTranscriptHandler = on('live-transcript', handleLiveTranscript);
    const errorHandler = on('error', handleError);

    eventHandlers.set(useTranscriptions, {
      transcriptionReady: transcriptionReadyHandler,
      liveTranscript: liveTranscriptHandler,
      error: errorHandler,
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && isTranscriptionReady) {
        // Send audio-chunk as a message event
        emit('audio-chunk', { chunk: event.data });
        console.log(`Sent audio chunk of size ${event.data.size} bytes`);
      }
    };

    // Send start-transcription as a message event
    emit('start-transcription', { userUuid: userUuid.value, channelName: channelName.value });

    return () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }
      // Send stop-transcription as a message event
      emit('stop-transcription', {});
      isTranscriptionReady = false;

      // Clean up event handlers
      const handlers = eventHandlers.get(useTranscriptions);
      if (handlers) {
        off('transcription-ready', handlers.transcriptionReady);
        off('live-transcript', handlers.liveTranscript);
        off('error', handlers.error);
        eventHandlers.delete(useTranscriptions);
      }
    };
  };

  const clearTranscriptBuffer = () => {
    transcriptBuffer.value = [];
    concatenatedTranscript = '';
  };

  const getLiveTranscript = () => {
    return {
      filename: `Real Time Transcript ${new Date().toLocaleString()}`,
      data: {
        segments: transcriptBuffer.value.map(segment => ({
          text: segment.text,
          start: 0, // Placeholder; Deepgram live doesn't provide segment timing
          end: 0,   // Placeholder
          speaker: 'You'
        })),
        speakers: [{ id: 'You', displayName: 'You' }]
      }
    };
  };

  return {
    transcriptions,
    liveTranscriptions,
    validateFile,
    transcribeFile,
    startLiveTranscription,
    clearTranscriptBuffer,
    getLiveTranscript,
    transcriptBuffer, // Expose for debugging if needed
    SUPPORTED_EXTENSIONS
  };
};