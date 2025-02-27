import eventBus from './eventBus.js';
import { socketManager } from '../utils/socketManager.js';

const userUuid = Vue.ref(sessionStorage.getItem('userUuid') || uuidv4());
const displayName = Vue.ref(sessionStorage.getItem('displayName') || '');
const channelName = Vue.ref(sessionStorage.getItem('channelName') || '');
const isConnected = Vue.ref(false);
const connectionStatus = Vue.ref('disconnected');
const activeUsers = Vue.ref(socketManager.activeUsers);
const connectionError = Vue.ref(null);
const lastMessageTimestamp = Vue.ref(0);

// Load and persist user color from sessionStorage, specific to the channel
const userColor = Vue.ref(sessionStorage.getItem(`userColor_${channelName.value}_${userUuid.value}`) || '');

// Tolerance for timestamp differences (in milliseconds, e.g., 5 seconds)
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
      console.error('Invalid message format: Missing type or not an object', data);
      return;
    }

    const processedData = {
      ...data,
      timestamp: data.serverTimestamp || data.timestamp || Date.now(), // Prefer server timestamp
    };

    if (['user-list', 'user-joined'].includes(processedData.type)) {
      console.log(`Processing critical update: ${processedData.type}`);
    } else {
      const timeDiff = processedData.timestamp - lastMessageTimestamp.value;
      if (processedData.timestamp < lastMessageTimestamp.value - TIMESTAMP_TOLERANCE) {
        console.warn('Ignoring outdated message (beyond tolerance):', processedData, `Time difference: ${timeDiff}ms`);
        return;
      }
    }
    lastMessageTimestamp.value = Math.max(lastMessageTimestamp.value, processedData.timestamp);

    switch (processedData.type) {
      case 'init-state':
        console.log('Received initial state:', processedData.state);
        eventBus.$emit('sync-history-data', processedData.state);
        break;
      case 'user-list':
        activeUsers.value = processedData.users || {};
        if (!activeUsers.value[userUuid.value] && userUuid.value) {
          activeUsers.value = {
            ...activeUsers.value,
            [userUuid.value]: {
              displayName: displayName.value,
              color: userColor.value || '#808080', // Use stored color or default to grey
              joinedAt: Date.now(),
            },
          };
        }
        eventBus.$emit('user-list', activeUsers.value);
        break;
      case 'user-joined':
        activeUsers.value = {
          ...activeUsers.value,
          [processedData.userUuid]: {
            displayName: processedData.displayName,
            color: processedData.color || (processedData.userUuid === userUuid.value ? userColor.value : '#808080'), // Use stored color for self
            joinedAt: processedData.timestamp || Date.now(),
          },
        };
        eventBus.$emit('user-joined', processedData);
        break;
      case 'upload-to-cloud-success':
        console.log('State uploaded to server successfully');
        eventBus.$emit('upload-to-cloud-success', processedData);
        break;
      case 'add-chat':
        eventBus.$emit('add-chat', processedData);
        break;
      case 'draft-chat':
        eventBus.$emit('draft-chat', processedData);
        break;
      case 'update-chat':
        eventBus.$emit('update-chat', processedData);
        break;
      case 'delete-chat':
        eventBus.$emit('delete-chat', processedData);
        break;
      case 'add-goal':
        eventBus.$emit('add-goal', processedData);
        break;
      case 'update-goal':
        eventBus.$emit('update-goal', processedData);
        break;
      case 'remove-goal':
        eventBus.$emit('remove-goal', processedData);
        break;
      case 'reorder-goals':
        eventBus.$emit('reorder-goals', processedData);
        break;
      case 'add-agent':
        eventBus.$emit('add-agent', processedData);
        break;
      case 'update-agent':
        eventBus.$emit('update-agent', processedData);
        break;
      case 'remove-agent':
        eventBus.$emit('remove-agent', processedData);
        break;
      case 'chat-message':
        eventBus.$emit('chat-message', processedData);
        break;
      case 'add-clip':
        eventBus.$emit('add-clip', processedData);
        break;
      case 'remove-clip':
        eventBus.$emit('remove-clip', processedData);
        break;
      case 'add-document':
        eventBus.$emit('add-document', processedData);
        break;
      case 'remove-document':
        eventBus.$emit('remove-document', processedData);
        break;
      case 'rename-document':
        eventBus.$emit('rename-document', processedData);
        break;
      case 'add-question':
        eventBus.$emit('add-question', processedData);
        break;
      case 'update-question':
        eventBus.$emit('update-question', processedData);
        break;
      case 'remove-question':
        eventBus.$emit('remove-question', processedData);
        break;
      case 'reorder-questions':
        eventBus.$emit('reorder-questions', processedData);
        break;
      case 'add-artifact':
        eventBus.$emit('add-artifact', processedData);
        break;
      case 'remove-artifact':
        eventBus.$emit('remove-artifact', processedData);
        break;
      case 'add-transcript':
        eventBus.$emit('add-transcript', processedData);
        break;
      case 'remove-transcript':
        eventBus.$emit('remove-transcript', processedData);
        break;
      case 'room-lock-toggle':
      case 'pong':
      case 'error':
        eventBus.$emit(processedData.type, processedData);
        break;
      case 'ping':
        eventBus.$emit('ping', processedData);
        break;
      default:
        console.warn('Unhandled message type:', processedData.type);
    }
  }

  function handleStatusChange(status, error) {
    connectionStatus.value = status;
    isConnected.value = status === 'connected';
    connectionError.value = error;
    if (error) console.error('Connection status changed:', error);
  }

  function generateMutedDarkColor() {
    // Muted dark mode colors: low RGB values (0-128) for dark, muted tones
    const r = Math.floor(Math.random() * 129); // 0-128
    const g = Math.floor(Math.random() * 129);
    const b = Math.floor(Math.random() * 129);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function connect(channel, name) {
    userUuid.value = sessionStorage.getItem('userUuid') || uuidv4();
    sessionStorage.setItem('userUuid', userUuid.value);
    displayName.value = name;
    channelName.value = channel;
    sessionStorage.setItem('displayName', name);
    sessionStorage.setItem('channelName', channel);

    // Handle user color registration and persistence
    const storedColor = sessionStorage.getItem(`userColor_${channel}_${userUuid.value}`);
    if (!storedColor) {
      userColor.value = generateMutedDarkColor();
      sessionStorage.setItem(`userColor_${channel}_${userUuid.value}`, userColor.value);
    } else {
      userColor.value = storedColor;
    }

    console.log('Emitting join-channel with:', {
      userUuid: userUuid.value,
      displayName: displayName.value,
      channelName: channelName.value,
      color: userColor.value,
    });

    Vue.nextTick(() => {
      socketManager.initializeSocket(channelName.value, userUuid.value, displayName.value, handleMessage, handleStatusChange, { color: userColor.value });
    });
  }

  function disconnect() {
    socketManager.disconnect(channelName.value, userUuid.value);
  }

  function emit(event, data) {
    socketManager.emit(event, { ...data, userUuid: userUuid.value, color: userColor.value }, channelName.value, userUuid.value);
  }

  function reconnect() {
    if (!isConnected.value) {
      console.log('Attempting to reconnect...');
      const storedColor = sessionStorage.getItem(`userColor_${channelName.value}_${userUuid.value}`);
      if (storedColor) {
        userColor.value = storedColor;
      } else {
        userColor.value = '#808080';
        sessionStorage.setItem(`userColor_${channelName.value}_${userUuid.value}`, userColor.value);
      }
      socketManager.reconnect(channelName.value, userUuid.value, displayName.value, handleMessage, handleStatusChange);
      socketManager.emit('join-channel', { userUuid: userUuid.value, displayName: displayName.value, channelName: channelName.value, color: userColor.value }, channelName.value, userUuid.value);
    }
  }

  function loadSession() {
    if (userUuid.value && displayName.value && channelName.value) {
      const storedColor = sessionStorage.getItem(`userColor_${channelName.value}_${userUuid.value}`);
      if (storedColor) {
        userColor.value = storedColor;
      } else {
        userColor.value = '#808080';
        sessionStorage.setItem(`userColor_${channelName.value}_${userUuid.value}`, userColor.value);
      }
      socketManager.initializeSocket(channelName.value, userUuid.value, displayName.value, handleMessage, handleStatusChange, { color: userColor.value });
      // socketManager.emit('join-channel', { userUuid: userUuid.value, displayName: displayName.value, channelName: channelName.value, color: userColor.value }, channelName.value, userUuid.value);
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
    off('add-clip');
    off('remove-clip');
    off('add-document');
    off('remove-document');
    off('rename-document');
    off('add-question');
    off('update-question');
    off('remove-question');
    off('reorder-questions');
    off('add-artifact');
    off('remove-artifact');
    off('add-transcript');
    off('remove-transcript');
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
    connect,
    disconnect,
    emit,
    reconnect,
    on,
    off,
    loadSession,
    cleanup,
    userColor,
  };
}