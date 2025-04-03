// composables/useTextToSpeech.js
let ttsVoices = Vue.ref(null);

export const useTextToSpeech = () => {
  const loadVoices = async () => {
    try {
      ttsVoices.value = await fetch(new URL(`../assets/voices.json`, import.meta.url))
        .then(res => res.ok ? res.json() : null);
      console.log("Loaded AI Voices");
    } catch (error) {
      console.warn('Error loading voices:', error);
      ttsVoices.value = [];
    }
  };

  const generateAudioStream = async (text, voiceId = "JBFqnCBsd6RMkjVDRZzb") => {
    try {
      console.log('Generating audio stream with text:', text, 'voiceId:', voiceId);
      const response = await fetch('/api/textToSpeech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          path: voiceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return {
        success: true,
        stream: response.body,
      };
    } catch (err) {
      console.error('Error in generateAudioStream:', err);
      return {
        success: false,
        error: err.message || 'Audio generation failed',
      };
    }
  };

  return {
    ttsVoices,
    loadVoices,
    generateAudioStream,
  };
};