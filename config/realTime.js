// realTime.js
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');

const channels = new Map();

const entityConfigs = {
  agents: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-agent', update: 'update-agent', remove: 'remove-agent', reorder: null } },
  chat: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-chat', update: 'update-chat', remove: 'delete-chat', draft: 'draft-chat' } },
  clips: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-clip', update: null, remove: 'remove-clip', reorder: null } },
  bookmarks: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-bookmark', update: 'update-bookmark', remove: 'remove-bookmark', reorder: null } },
  documents: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-document', update: 'rename-document', remove: 'remove-document', reorder: null } },
  goals: { idKey: 'id', requiredFields: ['id'], orderField: 'order', events: { add: 'add-goal', update: 'update-goal', remove: 'remove-goal', reorder: 'reorder-goals' } },
  questions: { idKey: 'id', requiredFields: ['id'], orderField: 'order', events: { add: 'add-question', update: 'update-question', remove: 'remove-question', reorder: 'reorder-questions' } },
  answers: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-answer', update: 'update-answer', remove: 'delete-answer', vote: 'vote-answer' } },
  artifacts: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-artifact', update: null, remove: 'remove-artifact', reorder: null } },
  transcripts: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-transcript', update: null, remove: 'remove-transcript', reorder: null } },
};

/**
 * Generates a muted dark color for user identification.
 * @returns {string} Hex color code (e.g., '#4a2b3c').
 */
function generateMutedDarkColor() {
  const r = Math.floor(Math.random() * 129);
  const g = Math.floor(Math.random() * 129);
  const b = Math.floor(Math.random() * 129);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function equityFilePath(channelName, entityType) {
  const channelDir = path.join(__dirname, '../channels');
  return path.join(channelDir, `${channelName}_${entityType}.json`);
}

function validateJoinData(data) {
  return data && data.userUuid && data.displayName && data.channelName && isValidChannelName(data.channelName);
}

function validateLeaveData(data) {
  return data && data.userUuid && data.channelName && isValidChannelName(data.channelName);
}

function validateMessage(data) {
  const isHeartbeat = data && data.type && (data.type === 'ping' || data.type === 'pong');
  if (isHeartbeat) return true;
  return data && data.userUuid && data.channelName && data.type && isValidChannelName(data.channelName);
}

function isValidChannelName(channelName) {
  if (!channelName || typeof channelName !== 'string') return false;
  return /^[a-zA-Z0-9_]+$/.test(channelName);
}

async function loadStateFromServer(channelName, entityType) {
  try {
    const filePath = equityFilePath(channelName, entityType);
    console.log(`Attempting to load ${entityType} from ${filePath}`);
    const data = await fs.readFile(filePath, 'utf8').then(JSON.parse).catch(() => []);
    console.log(`Loaded ${entityType} for ${channelName}:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error(`Error loading ${entityType} for ${channelName}:`, error);
    return [];
  }
}

async function saveStateToServer(channelName, entityType, state) {
  try {
    const filePath = equityFilePath(channelName, entityType);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2));
    console.log(`Channel ${channelName} ${entityType} state saved to ${filePath}`);
  } catch (error) {
    console.error(`Error saving ${entityType} state to server for channel ${channelName}:`, error);
  }
}

function broadcastToChannel(channelName, type, payload, excludeUuid = null) {
  if (channels.has(channelName)) {
    const channel = channels.get(channelName);
    const serverTimestamp = Date.now();
    let message;

    if (type === 'user-list') {
      const usersArray = Object.entries(channel.users).map(([userUuid, user]) => ({
        userUuid,
        displayName: user.displayName,
        color: user.color,
        joinedAt: user.joinedAt,
      }));
      message = {
        type,
        users: usersArray,
        timestamp: serverTimestamp,
      };
    } else if (type === 'user-joined') {
      message = {
        type,
        userUuid: payload.userUuid,
        displayName: payload.data.displayName,
        color: payload.data.color,
        joinedAt: serverTimestamp,
        timestamp: serverTimestamp,
      };
    } else if (type === 'user-left') {
      message = {
        type,
        userUuid: payload.userUuid,
        timestamp: serverTimestamp,
      };
    } else {
      message = {
        type,
        id: payload.id,
        userUuid: payload.userUuid,
        data: payload.data,
        timestamp: payload.timestamp || serverTimestamp,
        serverTimestamp,
      };
    }

    console.log(`Broadcasting ${type} to ${channelName}:`, message);
    for (const userUuid in channel.sockets) {
      if (userUuid !== excludeUuid) {
        channel.sockets[userUuid].emit('message', message);
      }
    }
  }
}

function cleanupUser(channelName, userUuid, socket) {
  if (channels.has(channelName)) {
    const channel = channels.get(channelName);
    if (channel.users[userUuid]) {
      delete channel.users[userUuid];
      delete channel.sockets[userUuid];
      socket.leave(channelName);

      if (Object.keys(channel.users).length === 0) {
        channels.delete(channelName);
        console.log(`Channel ${channelName} deleted (empty)`);
      } else {
        broadcastToChannel(channelName, 'user-left', { userUuid });
        broadcastToChannel(channelName, 'user-list', { id: null, userUuid, data: null });
      }
      console.log(`${userUuid} left channel ${channelName}`);
    }
  }
}

function validateEntity(payload, entityType, operation) {
  if (!payload.id) {
    return { valid: false, message: `Invalid ${entityType} data for ${operation}: missing id` };
  }
  return { valid: true, message: '' };
}

function updateCreateState(state, payload, entityType) {
  const config = entityConfigs[entityType];
  const entity = {
    id: payload.id,
    userUuid: payload.userUuid,
    data: { ...payload.data, color: payload.data.color || channels.get(payload.channelName)?.users[payload.userUuid]?.color || '#808080' }, // Add color from user or default
    timestamp: payload.timestamp,
  };
  const order = config.orderField ? state.length : undefined;
  if (order !== undefined) entity.data[config.orderField] = order;
  state.push(entity);
}

function updateUpdateState(state, payload, entityType) {
  const config = entityConfigs[entityType];
  const index = state.findIndex(item => item[config.idKey] === payload.id);
  if (index !== -1) {
    state[index].data = { ...state[index].data, ...payload.data };
    state[index].timestamp = payload.timestamp;
  }
}

function updateDeleteState(state, payload, entityType) {
  const config = entityConfigs[entityType];
  const newState = state.filter(item => item[config.idKey] !== payload.id);
  if (config.orderField) {
    newState.forEach((item, index) => { item.data[config.orderField] = index; });
  }
  return newState;
}

function updateReorderState(state, payload, entityType) {
  const config = entityConfigs[entityType];
  const order = payload.data.order;
  const newState = order.map(id => state.find(item => item[config.idKey] === id)).filter(Boolean);
  if (config.orderField) {
    newState.forEach((item, index) => { item.data[config.orderField] = index; });
  }
  return newState;
}

function updateVoteState(state, payload) {
  const answer = state.find(a => a.id === payload.id);
  if (answer) {
    answer.data = { ...answer.data, ...payload.data };
    answer.timestamp = payload.timestamp;
  }
}

async function handleCrudOperation(channelName, userUuid, type, payload, socket) {
  let operation, entityType;
  for (const [et, config] of Object.entries(entityConfigs)) {
    if (config.events.add === type) { operation = 'add'; entityType = et; break; }
    else if (config.events.update === type) { operation = 'update'; entityType = et; break; }
    else if (config.events.remove === type) { operation = 'remove'; entityType = et; break; }
    else if (config.events.reorder === type) { operation = 'reorder'; entityType = et; break; }
    else if (config.events.draft === type) { operation = 'draft'; entityType = et; break; }
    else if (config.events.vote === type) { operation = 'vote'; entityType = et; break; }
  }

  if (!operation || !entityType) {
    socket.emit('message', { type: 'error', message: `Invalid event type: ${type}`, timestamp: Date.now() });
    return;
  }

  const validation = validateEntity(payload, entityType, operation);
  if (!validation.valid) {
    socket.emit('message', { type: 'error', message: validation.message, timestamp: Date.now() });
    return;
  }

  if (!channels.has(channelName)) {
    socket.emit('message', { type: 'error', message: 'Invalid channel', timestamp: Date.now() });
    return;
  }

  const channel = channels.get(channelName);
  if (!Array.isArray(channel.state[entityType])) {
    channel.state[entityType] = [];
  }
  let state = channel.state[entityType];

  const timestamp = payload.timestamp || Date.now();
  const normalizedPayload = { ...payload, userUuid, timestamp, channelName };

  let updateFunc, shouldSave = true;
  switch (operation) {
    case 'add': updateFunc = updateCreateState; break;
    case 'update': updateFunc = updateUpdateState; break;
    case 'remove': updateFunc = updateDeleteState; break;
    case 'reorder': updateFunc = updateReorderState; break;
    case 'vote': updateFunc = updateVoteState; break;
    case 'draft': updateFunc = null; shouldSave = false; break;
    default:
      socket.emit('message', { type: 'error', message: `Unknown operation: ${operation}`, timestamp: Date.now() });
      return;
  }

  if (operation === 'draft') {
    broadcastToChannel(channelName, type, normalizedPayload, userUuid);
    return;
  }

  const newState = updateFunc ? updateFunc(state, normalizedPayload, entityType) : state;
  if (newState !== undefined) {
    channel.state[entityType] = newState;
    state = newState;
  }

  broadcastToChannel(channelName, type, normalizedPayload, userUuid);
  if (shouldSave) {
    await saveStateToServer(channelName, entityType, state);
  }
}

function createRealTimeServers(server, corsOptions) {
  const io = new Server(server, {
    cors: corsOptions || { origin: '*' },
    pingInterval: 5000,
    pingTimeout: 10000,
    maxHttpBufferSize: 1e9,
  });

  io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id}`);


    // Listen for errors on this specific socket
    socket.on('error', (error) => {
      if (error.message === 'Max buffer size exceeded') {
          console.error(`Rejected oversized message from ${socket.id}. 
              Size exceeded limit of ${io.engine.opts.maxHttpBufferSize} bytes`);
          // Optionally, you could notify the client
          socket.emit('error', 'Message too large');
      } else {
          console.error(`Socket error for ${socket.id}: ${error.message}`);
      }
  });
  
    socket.on('join-channel', async (data) => {
      if (!validateJoinData(data)) {
        socket.emit('message', { type: 'error', message: 'Invalid channel name or data', timestamp: Date.now() });
        return;
      }
    
      const { userUuid, displayName, channelName } = data;
      socket.join(channelName);
      socket.userUuid = userUuid;
    
      if (!channels.has(channelName)) {
        const initialState = {};
        for (const entityType of Object.keys(entityConfigs)) {
          initialState[entityType] = await loadStateFromServer(channelName, entityType);
        }
        channels.set(channelName, {
          users: {},
          sockets: {},
          state: initialState,
          locked: false,
        });
        console.log(`Initialized channel ${channelName} with state:`, initialState);
      }
    
      const channel = channels.get(channelName);
      if (channel.locked) {
        socket.emit('message', { type: 'error', message: 'Channel is Locked', timestamp: Date.now() });
        return;
      }
    
      const userColor = generateMutedDarkColor();
      channel.users[userUuid] = { displayName, color: userColor, joinedAt: Date.now() };
      channel.sockets[userUuid] = socket;
    
      const initStateMessage = {
        type: 'init-state',
        id: null,
        userUuid,
        data: channel.state,
        timestamp: Date.now(),
        serverTimestamp: Date.now(),
      };
      console.log(`Sending init-state to ${userUuid} in ${channelName}:`, initStateMessage);
      socket.emit('message', initStateMessage);
    
      broadcastToChannel(channelName, 'user-list', { id: null, userUuid, data: null });
      broadcastToChannel(channelName, 'user-joined', { id: null, userUuid, data: { displayName, color: userColor } });
    });

    socket.on('leave-channel', (data) => {
      if (!validateLeaveData(data)) return;
      cleanupUser(data.channelName, data.userUuid, socket);
    });

    socket.on('disconnect', () => {
      for (const [channelName, channel] of channels) {
        if (channel.sockets[socket.userUuid]) {
          cleanupUser(channelName, socket.userUuid, socket);
          break;
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });

    socket.on('message', async (data) => {
      await handleMessage(data, socket);
    });
  });
}

async function handleMessage(dataObj, socket) {
  if (!validateMessage(dataObj)) {
    socket.emit('message', { type: 'error', message: 'Invalid channel name or message format', timestamp: Date.now() });
    return;
  }

  const { id, userUuid, data, channelName, type } = dataObj;

  if (!channels.has(channelName) || !channels.get(channelName).sockets[userUuid]) {
    if (type !== 'ping' && type !== 'pong') {
      socket.emit('message', { type: 'error', message: 'Invalid channel or user', timestamp: Date.now() });
      return;
    }
  }

  const channel = channels.get(channelName);
  const userColor = channel.users[userUuid]?.color || '#808080';

  switch (type) {
    case 'ping':
      socket.emit('message', { type: 'pong', id: null, userUuid, data: null, timestamp: Date.now(), serverTimestamp: Date.now() });
      break;
    case 'pong':
      break;
    case 'update-tab':
      break;
      case 'scroll-to-page':
        break;
      case 'add-chat':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data: { ...data, color: userColor } }, socket);
      break;
    case 'draft-chat':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data }, socket);
      break;
    case 'update-chat':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data }, socket);
      break;
    case 'delete-chat':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data: null }, socket);
      break;
    case 'add-goal':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'update-goal':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'remove-goal':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'reorder-goals':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'add-agent':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'update-agent':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'remove-agent':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'add-clip':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'remove-clip':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'add-bookmark':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
      case 'update-bookmark':
        await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
        break;
      case 'remove-bookmark':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'add-document':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'remove-document':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'rename-document':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'add-question':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'update-question':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'remove-question':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'reorder-questions':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'add-answer':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'update-answer':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'delete-answer':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'vote-answer':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'add-artifact':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'remove-artifact':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'add-transcript':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'remove-transcript':
      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data, timestamp: dataObj.timestamp }, socket);
      break;
    case 'room-lock-toggle':
      channel.locked = data.locked;
      broadcastToChannel(channelName, type, { id: null, userUuid, data: { locked: data.locked }, timestamp: dataObj.timestamp });
      for (const entityType of Object.keys(entityConfigs)) {
        await saveStateToServer(channelName, entityType, channel.state[entityType]);
      }
      break;
    case 'upload-to-cloud':
      console.log('Upload to Cloud');
      for (const entityType of Object.keys(entityConfigs)) {
        await saveStateToServer(channelName, entityType, channel.state[entityType]);
      }
      break;
    case 'error':
    case 'unknown':
      break;
    default:
      console.warn(`Unknown message type: ${type}`);
      socket.emit('message', { type: 'error', message: `Unknown message type: ${type}`, timestamp: Date.now() });
  }
}

module.exports = { createRealTimeServers };