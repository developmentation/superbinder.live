// composables/useLLM.js
import { useRealTime } from './useRealTime.js';
import eventBus from './eventBus.js';

const llmRequests = Vue.ref({}); // { id: { llmResponse, isStreaming, llmError, status } }
const processedEvents = new Set();
const eventHandlers = new WeakMap();
let messageCounter = 0;

export function useLLM() {
  const { emit, on, off, userUuid, channelName } = useRealTime();

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
    messageCounter++;
    const eventKey = `draft-llm-${id}-${timestamp}-${messageCounter}`;
    console.log("Received draft-llm chunk (raw):", { id, data, timestamp, eventKey });

    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);

      initializeLLMRequest(id);

      const request = llmRequests.value[id];
      const content = typeof data.content === 'string' ? data.content : '';
      const lastContent = request.llmResponse.slice(-content.length);

      // Skip if the chunk is a duplicate of the last appended content
      if (content.length > 0 && content !== lastContent) {
        console.log('Appending chunk (trimmed):', JSON.stringify(content));
        request.llmResponse += content;
        request.isStreaming = true;
        request.status = 'streaming';
      } else {
        console.warn('Skipping duplicate or empty chunk for ID:', id, content);
      }

      if (data.end) {
        // request.llmResponse = request.llmResponse; // Final trim
        request.isStreaming = false;
        request.status = 'completed';
        console.log(`Stream completed for ID ${id} with full response:`, JSON.stringify(request.llmResponse));
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
    console.log("Received error message:", { id, message, timestamp, eventKey });
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
    llmRequests.value = {};
    messageCounter = 0;
  }

  return {
    llmRequests,
    triggerLLM,
    cleanup,
  };
}