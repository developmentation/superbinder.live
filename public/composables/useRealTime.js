// composables/useRealTime.js
import eventBus from './eventBus.js';
import { socketManager } from '../utils/socketManager.js';

const userUuid = Vue.ref(sessionStorage.getItem('userUuid') || uuidv4());
const displayName = Vue.ref(sessionStorage.getItem('displayName') || '');
const channelName = Vue.ref(sessionStorage.getItem('channelName') || '');
const isConnected = Vue.ref(false);
const connectionStatus = Vue.ref('disconnected');
const activeUsers = Vue.ref([]);
const connectionError = Vue.ref(null);
const lastMessageTimestamp = Vue.ref(0);
const userColor = Vue.ref(sessionStorage.getItem('userColor') || '#808080');
const isRoomLocked = Vue.ref(false);

const TIMESTAMP_TOLERANCE = 5000;

const sessionInfo = Vue.computed(() => ({
  userUuid: userUuid.value,
  displayName: displayName.value,
  channelName: channelName.value,
  isConnected: isConnected.value,
  error: connectionError.value,
}));

export function useRealTime() {
  function handleMessage(data) {
    if (typeof data !== 'object' || !data.type) {
      console.error('Invalid message format:', data);
      return;
    }

    let processedData;
    if (data.type === 'user-joined') {
      processedData = {
        type: data.type,
        userUuid: data.userUuid,
        displayName: data.displayName,
        color: data.color,
        joinedAt: data.joinedAt || data.timestamp || Date.now(),
        timestamp: data.timestamp || Date.now(),
      };
      if (processedData.userUuid === userUuid.value) {
        userColor.value = processedData.color;
        sessionStorage.setItem('userColor', userColor.value);
        console.log('User color set from server:', userColor.value);
      }
    } else if (data.type === 'user-list') {
      processedData = {
        type: data.type,
        users: Array.isArray(data.users) ? data.users : [],
        timestamp: data.timestamp || Date.now(),
      };
    } else if (data.type === 'user-left') {
      processedData = {
        type: data.type,
        userUuid: data.userUuid,
        timestamp: data.timestamp || Date.now(),
      };
    } else if (data.type === 'room-lock-toggle') {
      processedData = {
        type: data.type,
        channelName: data.channelName,
        locked: data.data ? data.data.locked : false,
        timestamp: data.timestamp || Date.now(),
      };
    } else if (data.type === 'remove-channel') {
      processedData = {
        type: data.type,
        id: data.id || null, // Allow id to be optional
        userUuid: data.userUuid,
        channelName: data.data?.channelName || data.channelName, // Allow either data.channelName or top-level channelName
        timestamp: data.timestamp || Date.now(),
      };
    } else {
      processedData = {
        type: data.type,
        id: data.id,
        userUuid: data.userUuid,
        data: data.data,
        timestamp: data.timestamp || Date.now(),
        serverTimestamp: data.serverTimestamp,
      };
    }

    const timeDiff = processedData.timestamp - lastMessageTimestamp.value;
    if (processedData.timestamp < lastMessageTimestamp.value - TIMESTAMP_TOLERANCE) {
      console.warn('Ignoring outdated message:', processedData, `Time difference: ${timeDiff}ms`);
      return;
    }
    lastMessageTimestamp.value = Math.max(lastMessageTimestamp.value, processedData.timestamp);

    switch (processedData.type) {
      case 'init-state':
        eventBus.$emit('sync-history-data', processedData);
        break;
      case 'user-list':
        activeUsers.value = processedData.users;
        eventBus.$emit('user-list', processedData);
        break;
      case 'user-joined':
        if (!activeUsers.value.some((user) => user.userUuid === processedData.userUuid)) {
          activeUsers.value.push(processedData);
        }
        eventBus.$emit('user-joined', processedData);
        break;
      case 'user-left':
        const userIndex = activeUsers.value.findIndex((user) => user.userUuid === processedData.userUuid);
        if (userIndex !== -1) {
          activeUsers.value.splice(userIndex, 1);
        }
        eventBus.$emit('user-left', processedData);
        break;
      case 'room-lock-toggle':
        isRoomLocked.value = processedData.locked;
        eventBus.$emit('room-lock-toggle', processedData);
        break;
      case 'remove-channel':
        // Check if the channel matches the current session
        if (processedData.channelName === channelName.value || (processedData.id && processedData.id === channelName.value)) {
          const removedBy = activeUsers.value.find(user => user.userUuid === processedData.userUuid)?.displayName || 'Unknown User';
          eventBus.$emit('session-removed', { removedBy });
          disconnect(); // Disconnect immediately
        }
        break;
      default:
        eventBus.$emit(processedData.type, processedData);
    }
  }

  function handleStatusChange(status, error) {
    connectionStatus.value = status;
    isConnected.value = status === 'connected';
    connectionError.value = error;
    if (error) console.error('Connection status changed:', error);
  }

  function connect(channel, name) {
    if (isConnected.value) {
      console.log('Already connected, skipping join');
      return;
    }
    userUuid.value = sessionStorage.getItem('userUuid') || uuidv4();
    sessionStorage.setItem('userUuid', userUuid.value);
    displayName.value = name;
    channelName.value = channel;
    sessionStorage.setItem('displayName', name);
    sessionStorage.setItem('channelName', channel);

    Vue.nextTick(() => {
      socketManager.initializeSocket(
        channelName.value,
        userUuid.value,
        displayName.value,
        handleMessage,
        handleStatusChange
      );
    });
  }

  function disconnect() {
    socketManager.disconnect(channelName.value, userUuid.value);
    activeUsers.value = [];
    console.log('Cleared activeUsers on disconnect:', {
      value: activeUsers.value,
      isArray: Array.isArray(activeUsers.value),
    });
  }

  function emit(event, data) {
    return new Promise((resolve, reject) => {
      try {
        socketManager.emit(event, data, channelName.value, userUuid.value);
        resolve();
      } catch (error) {
        console.error('Emit failed:', error);
        reject(error);
      }
    });
  }

  function reconnect() {
    if (!isConnected.value) {
      console.log('Attempting to reconnect...');
      socketManager.reconnect(
        channelName.value,
        userUuid.value,
        displayName.value,
        handleMessage,
        handleStatusChange
      );
      socketManager.emit(
        'join-channel',
        {
          userUuid: userUuid.value,
          displayName: displayName.value,
          channelName: channelName.value,
        },
        channelName.value,
        userUuid.value
      );
    }
  }

  function loadSession() {
    if (userUuid.value && displayName.value && channelName.value) {
      if (isConnected.value) {
        console.log('Already connected, skipping loadSession join');
        return;
      }
      socketManager.initializeSocket(
        channelName.value,
        userUuid.value,
        displayName.value,
        handleMessage,
        handleStatusChange
      );
      socketManager.emit(
        'join-channel',
        {
          userUuid: userUuid.value,
          displayName: displayName.value,
          channelName: channelName.value,
        },
        channelName.value,
        userUuid.value
      );
    }
  }

  function on(event, callback) {
    eventBus.$on(event, callback);
  }

  function off(event, callback) {
    eventBus.$off(event, callback);
  }

  function cleanup() {
    off('init-state');
    off('user-list');
    off('user-joined');
    off('user-left');
    off('add-chat');
    off('draft-chat');
    off('update-chat');
    off('delete-chat');
    off('add-goal');
    off('update-goal');
    off('remove-goal');
    off('reorder-goals');
    off('add-agent');
    off('update-agent');
    off('remove-agent');
    off('chat-message');
    off('add-document');
    off('remove-document');
    off('update-document');
    off('add-question');
    off('update-question');
    off('remove-question');
    off('reorder-questions');
    off('add-answer');
    off('update-answer');
    off('delete-answer');
    off('vote-answer');
    off('add-artifact');
    off('remove-artifact');
    off('add-transcript');
    off('remove-transcript');
    off('add-collab');
    off('draft-collab');
    off('delete-collab');
    off('update-collab');
    off('add-breakout');
    off('update-breakout');
    off('delete-breakout');
    off('session-removed');

    off('add-artifact');
    off('update-artifact');
    off('remove-artifact');

    off('add-prompt');
    off('update-prompt');
    off('remove-prompt');

    off('add-transcription');
    off('update-transcription');
    off('remove-transcription');

    off('add-liveTranscription');
    off('update-liveTranscription');
    off('remove-liveTranscription');

  }

  return {
    userUuid,
    displayName,
    channelName,
    isConnected,
    connectionStatus,
    activeUsers,
    connectionError,
    sessionInfo,
    userColor,
    isRoomLocked,
    connect,
    disconnect,
    emit,
    reconnect,
    on,
    off,
    loadSession,
    cleanup,
  };
}