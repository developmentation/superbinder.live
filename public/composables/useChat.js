// composables/useChat.js
import { useRealTime } from './useRealTime.js';

const messages = Vue.ref([]);
const draftMessages = Vue.ref({});
const draftInitialTimestamps = Vue.ref({}); // Track initial timestamps for drafts
const { emit, on, off, activeUsers, userUuid, userColor } = useRealTime();
const eventHandlers = new WeakMap();
const processedEvents = new Set();

export function useChat() {
  // Ensure unique handlers for each instance
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
        delete draftInitialTimestamps.value[senderUuid];
        console.log(`Processed add-chat for ${senderUuid} on device ${userUuid.value}, reset initial timestamp`);
        messages.value.push({
          id,
          userUuid: senderUuid,
          data: { text: data.text, color: finalColor },
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
      if (data.text.trim().length > 0) {
        const currentDraftId = draftMessages.value[senderUuid]?.id;
        if (!draftInitialTimestamps.value[senderUuid] || (currentDraftId && currentDraftId !== id)) {
          draftInitialTimestamps.value[senderUuid] = timestamp || Date.now();
          console.log(`New draft session for ${senderUuid} on device ${userUuid.value}: Initial timestamp set to ${draftInitialTimestamps.value[senderUuid]}, ID = ${id}`);
        } else {
          console.log(`Existing draft for ${senderUuid} on device ${userUuid.value}: Reusing initial timestamp ${draftInitialTimestamps.value[senderUuid]}, ID = ${id}`);
        }
        const draftMsg = {
          id,
          userUuid: senderUuid,
          data: { text: data.text },
          isDraft: true,
          timestamp: draftInitialTimestamps.value[senderUuid],
          color: '#4B5563',
          displayNameSuffix: '(typing)',
        };
        draftMessages.value[senderUuid] = draftMsg;
      } else if (data.text === '' || data.text == null) {
        delete draftMessages.value[senderUuid];
        delete draftInitialTimestamps.value[senderUuid];
        console.log(`Removed draft for ${senderUuid} on device ${userUuid.value}, cleaned up timestamp`);
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
        message.data.text = data.text;
        message.timestamp = timestamp || Date.now();
        messages.value = [...messages.value];
      }
    };

    handlers.handleDeleteChat = function ({ id }) {
      console.log(`Handling delete-chat for id: ${id}`);
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
    const data = { text: text, color: userColor.value || '#808080' };
    console.log('Sending message with newlines:', data.text);
    handlers.handleAddChat({ id, userUuid: userUuid.value, data });
    emit('add-chat', { id, userUuid: userUuid.value, data, timestamp: Date.now() });
    if (draftMessages.value[userUuid.value]) delete draftMessages.value[userUuid.value];
    delete draftInitialTimestamps.value[userUuid.value];
    console.log(`Sent message for ${userUuid.value}, reset initial timestamp`);
    draftMessages.value = { ...draftMessages.value };
  }

  function updateDraft(text) {
    if (typeof text !== 'string') {
      console.warn('Invalid text in updateDraft, expected string:', text);
      return;
    }
    let draftId = draftMessages.value[userUuid.value]?.id || uuidv4();
    console.log(`Update draft for ${userUuid.value}: Draft ID = ${draftId}, Text = "${text}"`);
    handlers.handleDraftChat({ id: draftId, userUuid: userUuid.value, data: { text: text || '' } });
    emit('draft-chat', { id: draftId, userUuid: userUuid.value, data: { text: text || '' }, timestamp: Date.now() });
  }

  function updateChat(id, text) {
    if (typeof text !== 'string' || !text.trim() || !id) {
      console.warn('Invalid parameters in updateChat, expected non-empty string id and text:', { id, text });
      return;
    }
    emit('update-chat', { id, userUuid: userUuid.value, data: { text: text }, timestamp: Date.now() });
  }

  function deleteChat(id) {
    if (!id) {
      console.warn('Invalid id in deleteChat, expected non-empty id:', { id });
      return;
    }
    console.log(`Emitting delete-chat for id: ${id} from userUuid: ${userUuid.value}`);
    emit('delete-chat', { id, userUuid: userUuid.value, data: null, timestamp: Date.now() })
      .then(() => {
        console.log(`Successfully emitted delete-chat for id: ${id}`);
        messages.value = messages.value.filter(m => m.id !== id);
        messages.value = [...messages.value];
      })
      .catch(error => {
        console.error('Error emitting delete-chat:', error);
      });
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
      off('add-chat', handlers.handleAddChat);
      off('draft-chat', handlers.handleDraftChat);
      off('update-chat', handlers.handleUpdateChat);
      off('delete-chat', handlers.handleDeleteChat);
      eventHandlers.delete(useChat);
    }
    processedEvents.clear();
    draftInitialTimestamps.value = {};
  }

  return {
    messages,
    draftMessages,
    draftInitialTimestamps,
    sendMessage,
    updateDraft,
    updateChat,
    deleteChat,
    activeUsers,
    cleanup,
  };
}