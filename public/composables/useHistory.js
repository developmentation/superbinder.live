// composables/useHistory.js
import { useAgents } from './useAgents.js';
import { useChat } from './useChat.js';
import { useClips } from './useClips.js';
import { useDocuments } from './useDocuments.js';
import { useGoals } from './useGoals.js';
import { useQuestions } from './useQuestions.js';
import { useArtifacts } from './useArtifacts.js';
import { useTranscripts } from './useTranscripts.js';
import { useCollaboration } from './useCollaboration.js';
import eventBus from './eventBus.js';

export function useHistory() {
  function gatherLocalHistory() {
    const history = {
      agents: [...useAgents().agents.value],
      chat: [...useChat().messages.value],
      clips: [...useClips().clips.value],
      bookmarks: [...useClips().bookmarks.value],
      documents: [...useDocuments().documents.value],
      goals: [...useGoals().goals.value],
      questions: [...useQuestions().questions.value],
      answers: [...useQuestions().answers.value],
      artifacts: [...(useArtifacts().artifacts.value || [])],
      transcripts: [...(useTranscripts().transcripts.value || [])],
      breakout: [...(useCollaboration().breakouts.value || [])],
      collab: [...(useCollaboration().collabs.value || [])],
    };
    return history;
  }

  function syncChannelData(data) {
    if (!data || typeof data !== 'object') {
      console.warn('Invalid or undefined history data received, skipping sync:', data);
      return;
    }
    const historyData = data.data || data;
    const hasData = Object.keys(historyData).some(key => Array.isArray(historyData[key]) && historyData[key].length > 0);

    if (hasData) {
      // Merge function that preserves local data and adds unique incoming items
      const mergeArrays = (existing, incoming) => {
        const existingIds = new Set(existing.map(item => item.id)); // Track local IDs
        // Filter incoming items to only include those not already in existing
        const uniqueIncoming = (incoming || []).filter(item => !existingIds.has(item.id));
        // Return local items first, followed by unique incoming items
        return [...existing, ...uniqueIncoming];
      };

      useAgents().agents.value = mergeArrays(useAgents().agents.value, historyData.agents);
      useChat().messages.value = mergeArrays(useChat().messages.value, historyData.chat);
      useClips().clips.value = mergeArrays(useClips().clips.value, historyData.clips);
      useClips().bookmarks.value = mergeArrays(useClips().bookmarks.value, historyData.bookmarks);
      useDocuments().documents.value = mergeArrays(useDocuments().documents.value, historyData.documents);
      useGoals().goals.value = mergeArrays(useGoals().goals.value, historyData.goals);
      useQuestions().questions.value = mergeArrays(useQuestions().questions.value, historyData.questions);
      useQuestions().answers.value = mergeArrays(useQuestions().answers.value, historyData.answers);
      useArtifacts().artifacts.value = mergeArrays(useArtifacts().artifacts.value || [], historyData.artifacts);
      useTranscripts().transcripts.value = mergeArrays(useTranscripts().transcripts.value || [], historyData.transcripts);
      useCollaboration().breakouts.value = mergeArrays(useCollaboration().breakouts.value || [], historyData.breakout);
      useCollaboration().collabs.value = mergeArrays(useCollaboration().collabs.value || [], historyData.collab);
    } else {
      console.warn('No meaningful data in history, skipping sync:', historyData);
    }
  }

  eventBus.$on('request-history-data', (callback) => {
    const history = gatherLocalHistory();
    callback(history);
  });

  eventBus.$on('sync-history-data', (data) => {
    syncChannelData(data);
  });

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