// composables/useChat.js
import { useRealTime } from './useRealTime.js';

const messages = Vue.ref([]);
const draftMessages = Vue.ref({});
const { emit, on, off, activeUsers, userUuid, userColor } = useRealTime();
const eventHandlers = new WeakMap();
const processedEvents = new Set();

export function useChat() {
  if (!eventHandlers.has(useChat)) {
    const handlers = {};

    handlers.handleAddChat = function ({ id, userUuid: senderUuid, data, timestamp }) {
      const eventKey = `add-chat-${id}-${timestamp}`;
      if (!processedEvents.has(eventKey)) {
        processedEvents.add(eventKey);
        if (typeof data.text !== 'string') {
          console.warn('Invalid text in add-chat event, expected string:', data.text);
          return;
        }
        const finalColor = data.color || (senderUuid === userUuid.value ? userColor.value : getUserColor(senderUuid)) || '#808080';
        if (draftMessages.value[senderUuid]) delete draftMessages.value[senderUuid];
        messages.value.push({
          id,
          userUuid: senderUuid,
          data: { text: data.text.trim(), color: finalColor },
          timestamp: timestamp || Date.now(),
        });
        messages.value = [...messages.value];
        setTimeout(() => processedEvents.delete(eventKey), 1000);
      }
    };

    handlers.handleDraftChat = function ({ id, userUuid: senderUuid, data, timestamp }) {
      if (typeof data.text !== 'string') {
        console.warn('Invalid text in draft-chat event, expected string:', data.text);
        return;
      }
      if (data.text.trim() || data.text === '') {
        const draftMsg = {
          id,
          userUuid: senderUuid,
          data: { text: data.text.trim() },
          isDraft: true,
          timestamp: timestamp || Date.now(),
          color: '#4B5563',
          displayNameSuffix: '(typing)',
        };
        draftMessages.value[senderUuid] = draftMsg;
      } else if (!data.text) {
        delete draftMessages.value[senderUuid];
      }
      draftMessages.value = { ...draftMessages.value };
    };

    handlers.handleUpdateChat = function ({ id, userUuid: senderUuid, data, timestamp }) {
      if (typeof data.text !== 'string') {
        console.warn('Invalid text in update-chat event, expected string:', data.text);
        return;
      }
      const message = messages.value.find(m => m.id === id && m.userUuid === senderUuid);
      if (message) {
        message.data.text = data.text.trim();
        message.timestamp = timestamp || Date.now();
        messages.value = [...messages.value];
      }
    };

    handlers.handleDeleteChat = function ({ id }) {
      messages.value = messages.value.filter(m => m.id !== id);
      messages.value = [...messages.value];
    };

    handlers.addChat = on('add-chat', handlers.handleAddChat);
    handlers.draftChat = on('draft-chat', handlers.handleDraftChat);
    handlers.updateChat = on('update-chat', handlers.handleUpdateChat);
    handlers.deleteChat = on('delete-chat', handlers.handleDeleteChat);
    eventHandlers.set(useChat, handlers);
  }

  const handlers = eventHandlers.get(useChat);

  function sendMessage(text) {
    if (typeof text !== 'string' || !text.trim()) {
      console.warn('Invalid text in sendMessage, expected non-empty string:', text);
      return;
    }
    const id = uuidv4();
    const data = { text: text.trim(), color: userColor.value || '#808080' }; // Use server-assigned color
    handlers.handleAddChat({ id, userUuid: userUuid.value, data });
    emit('add-chat', { id, userUuid: userUuid.value, data, timestamp: Date.now() });
    if (draftMessages.value[userUuid.value]) delete draftMessages.value[userUuid.value];
    draftMessages.value = { ...draftMessages.value };
  }

  function updateDraft(text) {
    if (typeof text !== 'string') {
      console.warn('Invalid text in updateDraft, expected string:', text);
      return;
    }
    let draftId = draftMessages.value[userUuid.value]?.id || uuidv4();
    handlers.handleDraftChat({ id: draftId, userUuid: userUuid.value, data: { text: text || '' } });
    emit('draft-chat', { id: draftId, userUuid: userUuid.value, data: { text: text || '' }, timestamp: Date.now() });
  }

  function updateChat(id, text) {
    if (typeof text !== 'string' || !text.trim() || !id) {
      console.warn('Invalid parameters in updateChat, expected non-empty string id and text:', { id, text });
      return;
    }
    emit('update-chat', { id, userUuid: userUuid.value, data: { text: text.trim() }, timestamp: Date.now() });
  }

  function deleteChat(id) {
    if (!id) {
      console.warn('Invalid id in deleteChat, expected non-empty id:', { id });
      return;
    }
    messages.value = messages.value.filter(m => m.id !== id);
    messages.value = [...messages.value];
    emit('delete-chat', { id, userUuid: userUuid.value, data: null, timestamp: Date.now() });
  }

  function getUserColor(userUuid) {
    if (userUuid === userUuid.value) {
      return userColor.value;
    }
    return activeUsers.value.find(user => user.userUuid === userUuid)?.color || '#808080';
  }

  function cleanup() {
    const handlers = eventHandlers.get(useChat);
    if (handlers) {
      off('add-chat', handlers.addChat);
      off('draft-chat', handlers.draftChat);
      off('update-chat', handlers.updateChat);
      off('delete-chat', handlers.deleteChat);
      eventHandlers.delete(useChat);
    }
    processedEvents.clear();
  }

  return {
    messages,
    draftMessages,
    sendMessage,
    updateDraft,
    updateChat,
    deleteChat,
    activeUsers,
    cleanup,
  };
}