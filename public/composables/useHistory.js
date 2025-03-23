// composables/useHistory.js
import { useAgents } from './useAgents.js';
import { useChat } from './useChat.js';
import { useDocuments } from './useDocuments.js';
import { useGoals } from './useGoals.js';
import { useQuestions } from './useQuestions.js';
import { useArtifacts } from './useArtifacts.js';
import { useCollaboration } from './useCollaboration.js';
import { useSections } from './useSections.js';
import eventBus from './eventBus.js';

export function useHistory() {
  function gatherLocalHistory() {
    const history = {
      agents: [...useAgents().agents.value],
      chat: [...useChat().messages.value],
      documents: [...useDocuments().documents.value],
      goals: [...useGoals().goals.value],
      questions: [...useQuestions().questions.value],
      answers: [...useQuestions().answers.value],
      artifacts: [...(useArtifacts().artifacts.value || [])],
      breakout: [...(useCollaboration().breakouts.value || [])],
      collab: [...(useCollaboration().collabs.value || [])],
      sections: [...(useSections().sections.value || [])],
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
      const mergeArrays = (existing, incoming, preservePages = false) => {
        const resultMap = new Map();

        existing.forEach(item => {
          if (item.id) resultMap.set(item.id, item);
        });

        (incoming || []).forEach(item => {
          if (!item.id) return;

          const existingItem = resultMap.get(item.id);
          
          if (existingItem) {
            const existingTime = existingItem.timestamp ? new Date(existingItem.timestamp).getTime() : 0;
            const incomingTime = item.timestamp ? new Date(item.timestamp).getTime() : 0;
            
            if (incomingTime > existingTime) {
              if (preservePages && existingItem.data && existingItem.data.pages) {
                // Preserve data.pages from the existing item
                item.data = { ...item.data, pages: existingItem.data.pages };
              }
              resultMap.set(item.id, item);
            } else if (incomingTime === existingTime) {
              // If timestamps are equal, preserve the existing item (including data.pages)
              return;
            }
          } else {
            resultMap.set(item.id, item);
          }
        });

        return Array.from(resultMap.values());
      };

      useAgents().agents.value = mergeArrays(useAgents().agents.value, historyData.agents);
      useChat().messages.value = mergeArrays(useChat().messages.value, historyData.chat);
      useDocuments().documents.value = mergeArrays(useDocuments().documents.value, historyData.documents, true); // Preserve data.pages
      useGoals().goals.value = mergeArrays(useGoals().goals.value, historyData.goals);
      useQuestions().questions.value = mergeArrays(useQuestions().questions.value, historyData.questions);
      useQuestions().answers.value = mergeArrays(useQuestions().answers.value, historyData.answers);
      useArtifacts().artifacts.value = mergeArrays(useArtifacts().artifacts.value || [], historyData.artifacts);
      useCollaboration().breakouts.value = mergeArrays(useCollaboration().breakouts.value || [], historyData.breakout);
      useCollaboration().collabs.value = mergeArrays(useCollaboration().collabs.value || [], historyData.collab);
      useSections().sections.value = mergeArrays(useSections().sections.value || [], historyData.sections);
    } else {
      console.log('No meaningful data in history, skipping sync:', historyData);
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