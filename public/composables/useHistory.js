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
    // console.log('Gathered local history in useHistory:', JSON.stringify(history, null, 2));
    return history;
  }

  function syncChannelData(data) {
    if (!data || typeof data !== 'object') {
      console.warn('Invalid or undefined history data received, skipping sync:', data);
      return;
    }
    const historyData = data.data || data;
    // console.log('Syncing channel data received:', JSON.stringify(historyData, null, 2));
    const hasData = Object.keys(historyData).some(key => Array.isArray(historyData[key]) && historyData[key].length > 0);
    if (hasData) {
      useAgents().agents.value = historyData.agents || [];
      useChat().messages.value = historyData.chat || [];
      useClips().clips.value = historyData.clips || [];
      useClips().bookmarks.value = historyData.bookmarks || [];
      useDocuments().documents.value = historyData.documents || [];
      useGoals().goals.value = historyData.goals || [];
      useQuestions().questions.value = historyData.questions || [];
      useQuestions().answers.value = historyData.answers || [];
      useArtifacts().artifacts.value = historyData.artifacts || [];
      useTranscripts().transcripts.value = historyData.transcripts || [];
      useCollaboration().breakouts.value = historyData.breakout || [];
      useCollaboration().collabs.value = historyData.collab || [];
      // console.log('Channel data synced:', {
      //   questions: useQuestions().questions.value,
      //   answers: useQuestions().answers.value,
      // });
    } else {
      console.warn('No meaningful data in history, skipping sync:', historyData);
    }
  }

  eventBus.$on('request-history-data', (callback) => {
    const history = gatherLocalHistory();
    // console.log('History requested via eventBus, returning:', JSON.stringify(history, null, 2));
    callback(history);
  });

  eventBus.$on('sync-history-data', (data) => {
    // console.log('Received sync-history-data event:', JSON.stringify(data, null, 2));
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