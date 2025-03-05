const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');

const channels = new Map();

const entityConfigs = {
  goals: { idKey: 'id', requiredFields: ['id', 'text'], orderField: 'order', events: { add: 'add-goal', update: 'update-goal', remove: 'remove-goal', reorder: 'reorder-goals' } },
  agents: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-agent', update: 'update-agent', remove: 'remove-agent', reorder: null } },
  chat: { idKey: 'id', requiredFields: ['id', 'text'], orderField: null, events: { add: 'add-chat', update: 'update-chat', remove: 'delete-chat', draft: 'draft-chat' } },
  clips: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-clip', update: null, remove: 'remove-clip', reorder: null } },
  bookmarks: { idKey: 'id', requiredFields: ['id', 'documentId'], orderField: null, events: { add: 'add-bookmark', update: null, remove: 'remove-bookmark', reorder: null } }, // Added bookmarks
  documents: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-document', update: 'rename-document', remove: 'remove-document', reorder: null } },
  questions: { idKey: 'id', requiredFields: ['id'], orderField: 'order', events: { add: 'add-question', update: 'update-question', remove: 'remove-question', reorder: 'reorder-questions' } },
  answers: { idKey: 'id', requiredFields: ['id', 'questionId'], orderField: null, events: { add: 'add-answer', update: 'update-answer', remove: 'delete-answer', vote: 'vote-answer' } },
  artifacts: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-artifact', update: null, remove: 'remove-artifact', reorder: null } },
  transcripts: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-transcript', update: null, remove: 'remove-transcript', reorder: null } },
};

function getEntityFilePath(channelName, entityType) {
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
    const filePath = getEntityFilePath(channelName, entityType);
    const data = await fs.readFile(filePath, 'utf8').then(JSON.parse).catch(() => []);
    return data;
  } catch (error) {
    console.error(`Error loading ${entityType} state from server for channel ${channelName}:`, error);
    return [];
  }
}

async function saveStateToServer(channelName, entityType, state) {
  try {
    const filePath = getEntityFilePath(channelName, entityType);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2));
    console.log(`Channel ${channelName} ${entityType} state saved to ${filePath}`);
  } catch (error) {
    console.error(`Error saving ${entityType} state to server for channel ${channelName}:`, error);
  }
}

function broadcastToChannel(channelName, type, data, excludeUuid = null) {
  if (channels.has(channelName)) {
    const channel = channels.get(channelName);
    const serverTimestamp = Date.now();
    const payload = { type, timestamp: serverTimestamp, serverTimestamp, ...data };
    for (const userUuid in channel.sockets) {
      if (userUuid !== excludeUuid) {
        channel.sockets[userUuid].emit('message', payload);
      }
    }
  }
}

function cleanupUser(channelName, userUuid, socket) {
  if (channels.has(channelName)) {
    const channel = channels.get(channelName);
    delete channel.users[userUuid];
    delete channel.sockets[userUuid];
    socket.leave(channelName);

    if (Object.keys(channel.users).length === 0) {
      channels.delete(channelName);
      console.log(`Channel ${channelName} deleted (empty)`);
    } else {
      broadcastToChannel(channelName, 'user-list', { users: channel.users });
    }
    console.log(`${userUuid} left channel ${channelName}`);
  }
}

function validateEntity(payload, entityType, operation) {
  const config = entityConfigs[entityType];
  if (!config) {
    return { valid: false, message: `Unknown entity type: ${entityType}` };
  }

  const eventConfig = config.events[operation];
  if (!eventConfig) {
    return { valid: false, message: `Unsupported operation ${operation} for ${entityType}` };
  }

  switch (operation) {
    case 'add':
    case 'update':
      const entity = payload.bookmark || payload.clip || payload.document || payload.question || payload.artifact || payload.transcript || payload.answer || payload;
      if (!entity || typeof entity !== 'object') {
        return { valid: false, message: `Invalid ${entityType} data for ${operation}: missing entity object` };
      }
      for (const field of config.requiredFields) {
        if (!(field in entity)) {
          return { valid: false, message: `Invalid ${entityType} data for ${operation}: missing ${field}` };
        }
      }
      return { valid: true, message: '' };
    case 'remove':
      if (!payload.id) {
        return { valid: false, message: `Invalid ${entityType} data for ${operation}: missing id` };
      }
      return { valid: true, message: '' };
    case 'reorder':
      if (!Array.isArray(payload.order) || payload.order.length === 0) {
        return { valid: false, message: `Invalid ${entityType} order format: expected non-empty array of IDs` };
      }
      return { valid: true, message: '' };
    case 'vote':
      if (!payload.questionId || !payload.answerId || !payload.vote || !['up', 'down'].includes(payload.vote)) {
        return { valid: false, message: `Invalid ${entityType} data for vote: missing or invalid fields` };
      }
      return { valid: true, message: '' };
    case 'draft':
      if (!payload.text || typeof payload.text !== 'string') {
        return { valid: false, message: `Invalid ${entityType} draft data: missing or invalid text` };
      }
      return { valid: true, message: '' };
    default:
      return { valid: false, message: `Unknown operation: ${operation}` };
  }
}

function updateCreateState(state, payload, entityType) {
  const config = entityConfigs[entityType];
  const entity = {
    ...payload,
    [config.idKey]: payload[config.idKey] || payload.id,
    userUuid: payload.userUuid,
    timestamp: payload.timestamp || Date.now(),
  };
  const order = config.orderField ? state.length : undefined;
  state.push({ ...entity, [config.orderField || '']: order });
}

function updateUpdateState(state, payload, entityType) {
  const config = entityConfigs[entityType];
  const entity = {
    ...payload,
    [config.idKey]: payload[config.idKey] || payload.id,
    userUuid: payload.userUuid,
    timestamp: payload.timestamp || Date.now(),
  };
  const index = state.findIndex(item => item[config.idKey] === entity[config.idKey]);
  if (index !== -1) {
    state[index] = { ...state[index], ...entity };
  }
}

function updateDeleteState(state, payload, entityType) {
  const config = entityConfigs[entityType];
  const id = payload[config.idKey] || payload.id;
  const newState = state.filter(item => item[config.idKey] !== id);
  if (config.orderField) {
    newState.forEach((item, index) => {
      item[config.orderField] = index;
    });
  }
  return newState;
}

function updateReorderState(state, payload, entityType) {
  const config = entityConfigs[entityType];
  const order = payload.order;
  const newState = order.map(id => {
    const item = state.find(item => item[config.idKey] === id);
    if (!item) return null;
    return item;
  }).filter(Boolean).map((item, index) => ({ ...item, [config.orderField || '']: index }));
  return newState;
}

function updateVoteState(state, payload) {
  const answer = state.find(a => a.id === payload.answerId);
  if (answer) {
    answer.votes = (answer.votes || 0) + (payload.vote === 'up' ? 1 : -1);
    answer.timestamp = Date.now();
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

  const config = entityConfigs[entityType];
  if (!config || !config.events[operation]) {
    socket.emit('message', { type: 'error', message: `Unsupported operation ${operation} for ${entityType}`, timestamp: Date.now() });
    return;
  }

  const validation = validateEntity(payload, entityType, operation);
  if (!validation.valid) {
    console.warn(validation.message, payload);
    socket.emit('message', { type: 'error', message: validation.message, timestamp: Date.now() });
    return;
  }

  if (!channels.has(channelName)) {
    socket.emit('message', { type: 'error', message: 'Invalid channel', timestamp: Date.now() });
    return;
  }

  const channel = channels.get(channelName);
  if (!Array.isArray(channel.state[entityType])) {
    console.warn(`State for ${entityType} in channel ${channelName} is not initialized. Initializing as empty array.`);
    channel.state[entityType] = [];
  }
  let state = channel.state[entityType];

  let updateFunc, shouldSave = true;
  switch (operation) {
    case 'add':
      updateFunc = updateCreateState;
      break;
    case 'update':
      updateFunc = updateUpdateState;
      break;
    case 'remove':
      updateFunc = updateDeleteState;
      break;
    case 'reorder':
      updateFunc = updateReorderState;
      break;
    case 'vote':
      updateFunc = updateVoteState;
      break;
    case 'draft':
      updateFunc = null;
      shouldSave = false;
      break;
    default:
      socket.emit('message', { type: 'error', message: `Unknown operation: ${operation}`, timestamp: Date.now() });
      return;
  }

  if (operation === 'draft') {
    const serverTimestamp = Date.now();
    broadcastToChannel(channelName, type, { 
      id: payload.id, 
      userUuid, 
      text: payload.text, 
      timestamp: serverTimestamp 
    }, userUuid);
    return;
  }

  const normalizedPayload = {
    ...payload.bookmark || payload.clip || payload.document || payload.question || payload.artifact || payload.transcript || payload.answer || payload,
    userUuid,
    timestamp: Date.now(),
  };

  if (entityType === 'answers' && operation === 'add') {
    const questionState = channel.state['questions'];
    const question = questionState.find(q => q.id === normalizedPayload.questionId);
    if (!question) {
      socket.emit('message', { type: 'error', message: 'Question not found', timestamp: Date.now() });
      return;
    }
    if (!question.answers) question.answers = [];
    question.answers.push(normalizedPayload.id);
    await saveStateToServer(channelName, 'questions', questionState);
  } else if (entityType === 'answers' && operation === 'remove') {
    const questionState = channel.state['questions'];
    const question = questionState.find(q => q.id === normalizedPayload.questionId);
    if (question && question.answers) {
      question.answers = question.answers.filter(answerId => answerId !== normalizedPayload.id);
      await saveStateToServer(channelName, 'questions', questionState);
    }
  } else if (entityType === 'questions' && operation === 'remove') {
    const answerState = channel.state['answers'];
    const question = state.find(q => q.id === normalizedPayload.id);
    if (question && question.answers) {
      const answerIds = question.answers;
      channel.state['answers'] = answerState.filter(a => !answerIds.includes(a.id));
      await saveStateToServer(channelName, 'answers', channel.state['answers']);
    }
  }

  const newState = updateFunc ? updateFunc(state, normalizedPayload, entityType) : state;
  if (newState !== undefined) {
    channel.state[entityType] = newState;
    state = newState;
  }

  let broadcastData;
  if (entityType === 'bookmarks' && operation === 'add') {
    broadcastData = { bookmark: normalizedPayload };
  } else if (entityType === 'bookmarks' && operation === 'remove') {
    broadcastData = { id: normalizedPayload[config.idKey] };
  } else if (entityType === 'agents' && (operation === 'add' || operation === 'update')) {
    broadcastData = { agent: normalizedPayload };
  } else if (entityType === 'agents' && operation === 'remove') {
    broadcastData = { id: normalizedPayload[config.idKey] };
  } else if (entityType === 'documents' && operation === 'add') {
    broadcastData = { document: normalizedPayload };
  } else if (entityType === 'documents' && operation === 'update') {
    broadcastData = { id: normalizedPayload.id, name: normalizedPayload.name };
  } else if (entityType === 'documents' && operation === 'remove') {
    broadcastData = { id: normalizedPayload[config.idKey] };
  } else if (entityType === 'answers' && (operation === 'add' || operation === 'update')) {
    broadcastData = { id: normalizedPayload.id, questionId: normalizedPayload.questionId, text: normalizedPayload.text || '' };
  } else if (entityType === 'answers' && operation === 'remove') {
    broadcastData = { id: normalizedPayload.id, questionId: normalizedPayload.questionId };
  } else if (entityType === 'answers' && operation === 'vote') {
    const answer = state.find(a => a.id === payload.answerId);
    broadcastData = { questionId: payload.questionId, answerId: payload.answerId, vote: payload.vote, votes: answer.votes };
  } else {
    broadcastData = {
      ...normalizedPayload,
      userUuid,
      [config.idKey]: normalizedPayload[config.idKey],
    };
  }

  console.log(`Broadcasting ${type} to channel ${channelName}:`, broadcastData);
  broadcastToChannel(channelName, type, broadcastData, userUuid);

  if (shouldSave) {
    await saveStateToServer(channelName, entityType, channel.state[entityType]);
  }
}

function createRealTimeServers(server, corsOptions) {
  const io = new Server(server, {
    cors: corsOptions || { origin: '*' },
    pingInterval: 5000,
    pingTimeout: 10000,
    maxHttpBufferSize: 1e8,
  });

  io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join-channel', async (data) => {
      if (!validateJoinData(data)) {
        socket.emit('message', { type: 'error', message: 'Invalid channel name or data', timestamp: Date.now() });
        return;
      }

      const { userUuid, displayName, channelName, color } = data;

      console.log("display and color", data);
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
      }

      const channel = channels.get(channelName);
      if (channel.locked) {
        socket.emit('message', { type: 'error', message: 'Channel is Locked', timestamp: Date.now() });
        return;
      }

      if (channel.users[userUuid]) {
        console.log(`${displayName} (${userUuid}) rejoined channel ${channelName}`);
      } else {
        console.log(`${displayName} (${userUuid}) joined channel ${channelName}`);
      }

      const userColor = color || '#808080';
      channel.users[userUuid] = { displayName, color: userColor, joinedAt: Date.now() };
      channel.sockets[userUuid] = socket;

      socket.emit('message', {
        type: 'init-state',
        userUuid,
        channelName,
        timestamp: Date.now(),
        state: channel.state,
      });

      broadcastToChannel(channelName, 'user-list', { users: channel.users });
      broadcastToChannel(channelName, 'user-joined', { userUuid, displayName, color: userColor, timestamp: Date.now() });
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

async function handleMessage(data, socket) {
  if (!validateMessage(data)) {
    socket.emit('message', { type: 'error', message: 'Invalid channel name or message format', timestamp: Date.now() });
    return;
  }

  const { userUuid, channelName, type, ...payload } = data;
  if (!channels.has(channelName) || !channels.get(channelName).sockets[userUuid]) {
    if (type !== 'ping' && type !== 'pong') {
      socket.emit('message', { type: 'error', message: 'Invalid channel or user', timestamp: Date.now() });
      return;
    }
  }

  const channel = channels.get(channelName);

  switch (type) {
    case 'ping':
      socket.emit('message', { type: 'pong', timestamp: Date.now() });
      break;
    case 'pong':
      break;
    case 'update-tab':
      break;
    case 'add-chat':
      await handleCrudOperation(channelName, userUuid, 'add-chat', { id: payload.id, text: payload.text, color: payload.color, userUuid }, socket);
      break;
    case 'draft-chat':
      const draftTimestamp = Date.now();
      broadcastToChannel(channelName, 'draft-chat', { id: payload.id, userUuid, text: payload.text, timestamp: draftTimestamp }, userUuid);
      break;
    case 'update-chat':
      await handleCrudOperation(channelName, userUuid, 'update-chat', { id: payload.id, text: payload.text, userUuid }, socket);
      break;
    case 'delete-chat':
      await handleCrudOperation(channelName, userUuid, 'delete-chat', { id: payload.id, userUuid }, socket);
      break;
    case 'add-goal':
      await handleCrudOperation(channelName, userUuid, 'add-goal', { id: payload.id, text: payload.text, userUuid }, socket);
      break;
    case 'update-goal':
      await handleCrudOperation(channelName, userUuid, 'update-goal', { id: payload.id, text: payload.text, userUuid }, socket);
      break;
    case 'remove-goal':
      await handleCrudOperation(channelName, userUuid, 'remove-goal', { id: payload.id, userUuid }, socket);
      break;
    case 'reorder-goals':
      await handleCrudOperation(channelName, userUuid, 'reorder-goals', { order: payload.order, userUuid }, socket);
      break;
    case 'add-agent':
      await handleCrudOperation(channelName, userUuid, 'add-agent', { ...payload.agent, userUuid }, socket);
      break;
    case 'update-agent':
      await handleCrudOperation(channelName, userUuid, 'update-agent', { ...payload.agent, userUuid }, socket);
      break;
    case 'remove-agent':
      await handleCrudOperation(channelName, userUuid, 'remove-agent', { id: payload.id, userUuid }, socket);
      break;
    case 'add-clip':
      await handleCrudOperation(channelName, userUuid, 'add-clip', { ...payload.clip, userUuid }, socket);
      break;
    case 'remove-clip':
      await handleCrudOperation(channelName, userUuid, 'remove-clip', { id: payload.clipId, userUuid }, socket);
      break;
    case 'add-bookmark':
      await handleCrudOperation(channelName, userUuid, 'add-bookmark', { ...payload.bookmark, userUuid }, socket);
      break;
    case 'remove-bookmark':
      await handleCrudOperation(channelName, userUuid, 'remove-bookmark', { id: payload.bookmarkId, userUuid }, socket);
      break;
    case 'add-document':
      await handleCrudOperation(channelName, userUuid, 'add-document', { ...payload.document, userUuid }, socket);
      break;
    case 'remove-document':
      await handleCrudOperation(channelName, userUuid, 'remove-document', { id: payload.id, userUuid }, socket);
      break;
    case 'rename-document':
      await handleCrudOperation(channelName, userUuid, 'rename-document', { id: payload.id, name: payload.name, userUuid }, socket);
      break;
    case 'add-question':
      await handleCrudOperation(channelName, userUuid, 'add-question', { ...payload.question, userUuid }, socket);
      break;
    case 'update-question':
      await handleCrudOperation(channelName, userUuid, 'update-question', { id: payload.id, text: payload.text, userUuid }, socket);
      break;    
    case 'remove-question':
      await handleCrudOperation(channelName, userUuid, 'remove-question', { id: payload.id, userUuid }, socket);
      break;
    case 'reorder-questions':
      await handleCrudOperation(channelName, userUuid, 'reorder-questions', { order: payload.order, userUuid }, socket);
      break;
    case 'add-answer':
      await handleCrudOperation(channelName, userUuid, 'add-answer', { id: payload.id, questionId: payload.questionId, text: '', userUuid }, socket);
      break;
    case 'update-answer':
      await handleCrudOperation(channelName, userUuid, 'update-answer', { id: payload.id, questionId: payload.questionId, text: payload.text, userUuid }, socket);
      break;
    case 'delete-answer':
      await handleCrudOperation(channelName, userUuid, 'delete-answer', { id: payload.id, questionId: payload.questionId, userUuid }, socket);
      break;
    case 'vote-answer':
      await handleCrudOperation(channelName, userUuid, 'vote-answer', { questionId: payload.questionId, answerId: payload.id, vote: payload.vote, userUuid }, socket);
      break;
    case 'add-artifact':
      await handleCrudOperation(channelName, userUuid, 'add-artifact', { ...payload.artifact, userUuid }, socket);
      break;
    case 'remove-artifact':
      await handleCrudOperation(channelName, userUuid, 'remove-artifact', { id: payload.artifactId, userUuid }, socket);
      break;
    case 'add-transcript':
      await handleCrudOperation(channelName, userUuid, 'add-transcript', { ...payload.transcript, userUuid }, socket);
      break;
    case 'remove-transcript':
      await handleCrudOperation(channelName, userUuid, 'remove-transcript', { id: payload.transcriptId, userUuid }, socket);
      break;
    case 'room-lock-toggle':
      channel.locked = payload.locked;
      broadcastToChannel(channelName, type, { channelName, locked: payload.locked, userUuid });
      for (const entityType of Object.keys(entityConfigs)) {
        await saveStateToServer(channelName, entityType, channel.state[entityType]);
      }
      break;
    case 'upload-to-cloud':
      console.log("Upload to Cloud");
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