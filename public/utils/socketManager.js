import { useConfigs } from '../composables/useConfigs.js';

const { env } = useConfigs();

let socket = null;
const activeUsers = {};

let heartbeatInterval = null;

function initializeSocket(channelName, userUuid, displayName, onMessage, onStatusChange, joinData = {}) {
  if (socket) {
    if (socket.connected) {
      console.log('Socket already connected, reusing existing connection');
      onStatusChange('connected', null);
      if (channelName && displayName) {
        socket.emit('join-channel', { userUuid, displayName, channelName, ...joinData });
      }
      return;
    } else {
      console.log('Cleaning up stale socket');
      socket.disconnect();
      socket = null;
    }
  }

  const apiUrl = env.value.API_URL;
  socket = io(apiUrl, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    timeout: 20000,
    transports: ['websocket'],
    path: '/socket.io',
  });

  socket.on('connect', () => {
    // console.log(`Connected to server with UUID: ${userUuid}, Socket ID: ${socket.id}`);
    onStatusChange('connected', null);
    if (channelName && displayName) {
      socket.emit('join-channel', { userUuid, displayName, channelName });
    }
    startHeartbeat(channelName, userUuid);
  });

  socket.on('disconnect', (reason) => {
    console.log(`Disconnected from server: ${reason}`);
    stopHeartbeat();
    onStatusChange('disconnected', reason === 'io server disconnect' || reason === 'transport close' ? `Disconnected: ${reason}` : null);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    onStatusChange('connecting', `Connection failed: ${error.message}`);
  });

  socket.on('message', (data) => {
    if (data.type === 'error') {
      console.error('Received error from server:', data);
      if (data.message === 'Invalid message format' || data.message === 'Invalid channel or user') {
        reconnect(channelName, userUuid, displayName, onMessage, onStatusChange);
      }
    }
    onMessage(data);
  });
}

function emit(event, data, channelName, userUuid) {
  if (socket && socket.connected) {
    const payload = {
      userUuid,
      channelName,
      timestamp: Date.now(),
      type: event,
      ...data,
    };
    socket.emit('message', payload);
  } else {
    console.warn('Socket not connected. Queuing message:', event, data);
  }
}

function disconnect(channelName, userUuid) {
  if (socket && socket.connected) {
    socket.emit('leave-channel', { userUuid, channelName });
    socket.disconnect();
    stopHeartbeat();
    socket = null;
  }
}

function reconnect(channelName, userUuid, displayName, onMessage, onStatusChange, joinData = {}) {
  disconnect(channelName, userUuid);
  initializeSocket(channelName, userUuid, displayName, onMessage, onStatusChange, joinData);
}

function startHeartbeat(channelName, userUuid) {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    emit('ping', {}, channelName, userUuid);
  }, 5000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export const socketManager = {
  initializeSocket,
  emit,
  disconnect,
  reconnect,
  activeUsers,
};
 