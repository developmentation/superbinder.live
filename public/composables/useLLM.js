// composables/useLLM.js
import { useRealTime } from './useRealTime.js';
import eventBus from './eventBus.js';

// Track all LLM requests by ID
const llmRequests = Vue.ref({}); // { id: { llmResponse, isStreaming, llmError, status } }

const processedEvents = new Set();
const eventHandlers = new WeakMap();
let messageCounter = 0; // Unique counter to avoid timestamp duplicates

export function useLLM() {
  const { emit, on, off, userUuid, channelName } = useRealTime();

  // Initialize or update an LLM request entry
  function initializeLLMRequest(id, isSelfInitiated = false) {
    if (!llmRequests.value[id]) {
      llmRequests.value[id] = {
        llmResponse: '',
        isStreaming: isSelfInitiated ? true : false,
        llmError: null,
        status: isSelfInitiated ? 'pending' : 'streaming',
      };
      llmRequests.value = { ...llmRequests.value };
    }
  }

  function handleDraftLLM(eventObj) {
    const { id, data, timestamp } = eventObj;
    messageCounter++; // Increment counter for uniqueness
    const eventKey = `draft-llm-${id}-${timestamp}-${messageCounter}`;
    console.log("Received draft-llm message:", { id, data, timestamp, eventKey }); // Debug all messages
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);

      initializeLLMRequest(id);

      const request = llmRequests.value[id];
      // Ensure data.content is a string and avoid object concatenation
      const content = typeof data.content === 'string' ? data.content : '';
      request.llmResponse += content;
      request.isStreaming = true;
      request.status = 'streaming';

      if (data.end) {
        request.isStreaming = false;
        request.status = 'completed';
        console.log(`Stream completed for ID ${id} with content:`, request.llmResponse); // Debug completion
      }

      llmRequests.value = { ...llmRequests.value };

      setTimeout(() => processedEvents.delete(eventKey), 1000);
    } else {
      console.warn(`Duplicate event skipped for key: ${eventKey}`);
    }
  }

  function handleError(eventObj) {
    const { id, message, timestamp } = eventObj;
    messageCounter++;
    const eventKey = `error-${id}-${timestamp}-${messageCounter}`;
    console.log("Received error message:", { id, message, timestamp, eventKey }); // Debug error messages
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);

      initializeLLMRequest(id);

      const request = llmRequests.value[id];
      request.isStreaming = false;
      request.llmError = message;
      request.status = 'error';

      llmRequests.value = { ...llmRequests.value };

      console.error('LLM Error for ID:', id, message);
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  const draftLLMHandler = on('draft-llm', handleDraftLLM);
  const errorHandler = on('error', handleError);

  eventHandlers.set(useLLM, {
    draft: draftLLMHandler,
    error: errorHandler,
  });

  function triggerLLM(id, model, temperature, systemPrompt, userPrompt, messageHistory, useJson) {
    initializeLLMRequest(id, true);

    const payload = {
      id,
      userUuid: userUuid.value,
      data: {
        model,
        temperature,
        systemPrompt,
        userPrompt,
        messageHistory,
        useJson,
      },
      timestamp: Date.now(),
    };
    emit('add-llm', payload);
  }

  function cleanup() {
    const handlers = eventHandlers.get(useLLM);
    if (handlers) {
      off('draft-llm', handlers.draft);
      off('error', handlers.error);
      eventHandlers.delete(useLLM);
    }
    processedEvents.clear();
    llmRequests.value = {}; // Reset all requests
    messageCounter = 0; // Reset counter on cleanup
  }

  return {
    llmRequests,
    triggerLLM,
    cleanup,
  };
}