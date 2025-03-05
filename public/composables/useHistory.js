// composables/useHistory.js
import { useAgents } from './useAgents.js';
import { useChat } from './useChat.js';
import { useClips } from './useClips.js';
import { useDocuments } from './useDocuments.js';
import { useGoals } from './useGoals.js';
import { useQuestions } from './useQuestions.js';
import { useArtifacts } from './useArtifacts.js';
import { useTranscripts } from './useTranscripts.js';
import eventBus from './eventBus.js'; // Use eventBus for communication

export function useHistory() {
  function gatherLocalHistory() {
    // Use Vue.toRaw or plain object creation to avoid Proxies
    const history = {
      agents: [...useAgents().agents.value], // Convert reactive array to plain array
      messages: [...useChat().messages.value], // Convert reactive array to plain array
      clips: [...useClips().clips.value],
      clips: [...useClips().bookmarks.value],
      documents: [...useDocuments().documents.value],
      goals: [...useGoals().goals.value],
      questions: [...useQuestions().questions.value],
      artifacts: [...(useArtifacts().artifacts.value || [])],
      transcripts: [...(useTranscripts().transcripts.value || [])],
    };
    console.log('Gathered local history in useHistory:', history); // Detailed debugging
    return history;
  }

  function syncChannelData(data) {
    if (!data || typeof data !== 'object') {
      console.warn('Invalid or undefined history data received, skipping sync:', data);
      return;
    }
    // Only sync if data has meaningful values
    const hasData = Object.keys(data).some(key => Array.isArray(data[key]) && data[key].length > 0);
    if (hasData) {
      useAgents().agents.value = data?.agents || [];
      useChat().messages.value = data?.chat || [];
      useClips().clips.value = data?.clips || [];
      useClips().bookmarks.value = data?.bookmarks || [];
      useDocuments().documents.value = data?.documents || [];
      useGoals().goals.value = data?.goals || [];
      useQuestions().questions.value = data?.questions || [];
      useArtifacts().artifacts.value = data?.artifacts || [];
      useTranscripts().transcripts.value = data?.transcripts || [];
      console.log('Channel data synced via useHistory:', data);
    } else {
      console.warn('No meaningful data in history, skipping sync:', data);
    }
  }

  // Register event listener for history requests from useRealTime
  eventBus.$on('request-history-data', (callback) => {
    const history = gatherLocalHistory();
    console.log('History requested via eventBus, returning:', history); // Debugging
    callback(history);
  });

  eventBus.$on('sync-history-data', (data) => {
    syncChannelData(data);
  });

  // Cleanup event listeners on unmount (handled by component using useHistory)
  function cleanup() {
    eventBus.$off('request-history-data');
    eventBus.$off('sync-history-data');
  }

  return {
    gatherLocalHistory,
    syncChannelData,
    cleanup,
  };
}