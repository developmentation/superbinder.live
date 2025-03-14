const { Server } = require('socket.io');
const mongoose = require('mongoose');
const connectDB = require('./db.js');
const { handlePrompt } = require("./handleAiInteractions");

const channels = new Map();

// Define Logs Schema for error tracking
const logSchema = new mongoose.Schema({
  timestamp: { type: Number, required: true, index: true },
  level: { type: String, required: true }, // e.g., 'error', 'warn'
  message: { type: String, required: true },
  stackTrace: { type: String },
  userUuid: { type: String },
  channelName: { type: String },
  socketId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed }, // Additional context
}, { timestamps: true });

const Log = mongoose.model('Log', logSchema, 'logs');

// EntitySet Schema
const entitySetSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true }, // Entity-specific ID (not _id)
  channel: { type: String, required: true, index: true },
  userUuid: { type: String, required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // Flexible data field
  timestamp: { type: Number, required: true },
  serverTimestamp: { type: Number, required: true, index: true },
}, { timestamps: true });

// Define models for each entity type
const entityModels = {};
Object.keys({
  agents: 'agentSet',
  chat: 'chatSet',
  clips: 'clipSet',
  bookmarks: 'bookmarkSet',
  documents: 'documentSet',
  goals: 'goalSet',
  questions: 'questionSet',
  answers: 'answerSet',
  artifacts: 'artifactSet',
  transcripts: 'transcriptSet',
  llm: 'llmSet',
  collab: 'collabSet',
  breakout: 'breakoutSet',
  sections: 'sectionSet',
}).forEach(entityType => {
  const collectionName = `${entityType}Set`;
  entityModels[entityType] = mongoose.model(collectionName, entitySetSchema, collectionName);
});

async function verifyIndexes() {
  try {
    for (const [entityType, model] of Object.entries(entityModels)) {
      const indexes = await model.collection.listIndexes().toArray();
      const expectedIndexes = ['id', 'channel', 'userUuid', 'serverTimestamp'];
      const hasAllIndexes = expectedIndexes.every(key =>
        indexes.some(index => index.key && Object.keys(index.key).includes(key))
      );
    }
  } catch (err) {
    await logError('error', `Error verifying indexes: ${err.message}`, err.stack);
  }
}

async function initializeDatabase() {
  try {
    await connectDB();
    await verifyIndexes();
  } catch (err) {
    await logError('error', 'Failed to initialize database', err.stack);
    process.exit(1); // Still exit on database initialization failure
  }
}

initializeDatabase().catch(err => {
  console.error('Uncaught database initialization error:', err);
  process.exit(1);
});

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
  llm: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-llm', draft: 'draft-llm' } },
  collab: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-collab', update: 'update-collab', remove: 'delete-collab', draft: 'draft-collab' } },
  breakout: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-breakout', update: 'update-breakout', remove: 'delete-breakout', reorder: null } },
  sections: { idKey: 'id', requiredFields: ['id'], orderField: null, events: { add: 'add-section', update: 'update-section', remove: 'remove-section', reorder: 'reorder-section' } },
};

/**
 * Generates a muted dark color for user identification.
 */
function generateMutedDarkColor() {
  const r = Math.floor(Math.random() * 129);
  const g = Math.floor(Math.random() * 129);
  const b = Math.floor(Math.random() * 129);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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

function validateLLMData(data) {
  return data && typeof data.model === 'object' && data.model.provider && data.model.name && data.model.model &&
         typeof data.temperature === 'number' && data.temperature >= 0 && data.temperature <= 1 &&
         typeof data.systemPrompt === 'string' && typeof data.userPrompt === 'string' &&
         Array.isArray(data.messageHistory) && typeof data.useJson === 'boolean';
}

async function loadStateFromServer(channelName, entityType) {
  try {
    const model = entityModels[entityType];
    const state = await model.find({ channel: channelName }).lean();
    return state.map(doc => ({
      id: doc.id,
      userUuid: doc.userUuid,
      data: doc.data,
      timestamp: doc.timestamp,
      serverTimestamp: doc.serverTimestamp,
    }));
  } catch (error) {
    await logError('error', `Error loading ${entityType} for ${channelName}`, error.stack);
    return [];
  }
}

function broadcastToChannel(channelName, type, payload, excludeUuid = null) {
  try {
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
        message = { type, users: usersArray, timestamp: serverTimestamp };
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
        message = { type, userUuid: payload.userUuid, timestamp: serverTimestamp };
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

      for (const userUuid in channel.sockets) {
        if (userUuid !== excludeUuid && channel.sockets[userUuid]) {
          channel.sockets[userUuid].emit('message', message);
        }
      }
    }
  } catch (err) {
    logError('error', `Broadcast error for ${channelName}`, err.stack);
  }
}

function cleanupUser(channelName, userUuid, socket) {
  try {
    if (channels.has(channelName)) {
      const channel = channels.get(channelName);
      if (channel.users[userUuid]) {
        delete channel.users[userUuid];
        if (channel.sockets[userUuid]) {
          delete channel.sockets[userUuid];
          socket.leave(channelName);
        }

        if (Object.keys(channel.users).length === 0) {
          channels.delete(channelName);
        } else {
          broadcastToChannel(channelName, 'user-left', { userUuid });
          broadcastToChannel(channelName, 'user-list', { id: null, userUuid, data: null });
        }
      }
    }
  } catch (err) {
    logError('error', `Cleanup error for ${channelName} and ${userUuid}`, err.stack, userUuid, channelName, socket.id);
  }
}

function validateEntity(payload, entityType, operation) {
  if (!payload.id) {
    return { valid: false, message: `Invalid ${entityType} data for ${operation}: missing id` };
  }
  return { valid: true, message: '' };
}

async function updateCreateState(channelName, entityType, payload) {
  try {
    const config = entityConfigs[entityType];
    const entity = {
      id: payload.id,
      channel: channelName,
      userUuid: payload.userUuid,
      data: { ...payload.data, color: payload.data.color || channels.get(channelName)?.users[payload.userUuid]?.color || '#808080' },
      timestamp: payload.timestamp,
      serverTimestamp: Date.now(),
    };
    const order = config.orderField ? await entityModels[entityType].countDocuments({ channel: channelName }) : undefined;
    if (order !== undefined) entity.data[config.orderField] = order;
    await entityModels[entityType].create(entity);
  } catch (err) {
    await logError('error', `Failed to create ${entityType} for ${channelName}`, err.stack, payload.userUuid, channelName);
  }
}

async function updateUpdateState(channelName, entityType, payload) {
  try {
    const config = entityConfigs[entityType];
    await entityModels[entityType].updateOne(
      { id: payload.id, channel: channelName },
      { $set: { data: payload.data, timestamp: payload.timestamp, serverTimestamp: Date.now() } }
    );
  } catch (err) {
    await logError('error', `Failed to update ${entityType} for ${channelName}`, err.stack, payload.userUuid, channelName);
  }
}

async function updateDeleteState(channelName, entityType, payload) {
  try {
    const config = entityConfigs[entityType];
    await entityModels[entityType].deleteOne({ id: payload.id, channel: channelName });
    if (config.orderField) {
      const remaining = await entityModels[entityType].find({ channel: channelName }).sort({ 'data.order': 1 });
      await Promise.all(remaining.map((item, index) =>
        entityModels[entityType].updateOne(
          { _id: item._id },
          { $set: { 'data.order': index, serverTimestamp: Date.now() } }
        )
      ));
    }
  } catch (err) {
    await logError('error', `Failed to delete ${entityType} for ${channelName}`, err.stack, payload.userUuid, channelName);
  }
}

async function updateReorderState(channelName, entityType, payload) {
  try {
    const config = entityConfigs[entityType];
    const order = payload.data.order;
    const entities = await entityModels[entityType].find({ channel: channelName, id: { $in: order } });
    await Promise.all(order.map((id, index) => {
      const entity = entities.find(e => e.id === id);
      if (entity) {
        entity.data[config.orderField] = index;
        return entityModels[entityType].updateOne(
          { id, channel: channelName },
          { $set: { 'data.order': index, serverTimestamp: Date.now() } }
        );
      }
    }));
  } catch (err) {
    await logError('error', `Failed to reorder ${entityType} for ${channelName}`, err.stack, payload.userUuid, channelName);
  }
}

async function updateVoteState(channelName, entityType, payload) {
  try {
    await entityModels[entityType].updateOne(
      { id: payload.id, channel: channelName },
      { $set: { data: payload.data, timestamp: payload.timestamp, serverTimestamp: Date.now() } }
    );
  } catch (err) {
    await logError('error', `Failed to vote on ${entityType} for ${channelName}`, err.stack, payload.userUuid, channelName);
  }
}

async function sendLLMStream(uuid, channelName, session, type, message, isEnd = false) {
  try {
    const payload = {
      type,
      id: uuid,
      userUuid: uuid,
      data: { content: message, ...(isEnd ? { end: true } : {}) },
      timestamp: Date.now(),
      serverTimestamp: Date.now(),
    };
    broadcastToChannel(channelName, type, payload);
  } catch (err) {
    await logError('error', `Failed to send LLM stream for ${channelName}`, err.stack, uuid, channelName);
  }
}

async function handleCrudOperation(channelName, userUuid, type, payload, socket) {
  try {
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

    const timestamp = payload.timestamp || Date.now();
    const normalizedPayload = { ...payload, userUuid, timestamp, channelName };

    if (entityType === 'llm' && operation === 'add') {
      if (!validateLLMData(payload.data)) {
        socket.emit('message', { type: 'error', message: 'Invalid LLM data', timestamp: Date.now() });
        return;
      }

      const promptConfig = {
        model: payload.data.model,
        uuid: payload.id,
        session: channelName,
        temperature: payload.data.temperature,
        systemPrompt: payload.data.systemPrompt,
        userPrompt: payload.data.userPrompt,
        messageHistory: payload.data.messageHistory,
        useJson: payload.data.useJson,
      };

      await handlePrompt(promptConfig, async (uuid, session, type, message) => {
        try {
          if (type === 'message') {
            await sendLLMStream(uuid, channelName, session, 'draft-llm', message);
          } else if (type === 'EOM') {
            await sendLLMStream(uuid, channelName, session, 'draft-llm', message, true);
          } else if (type === 'ERROR') {
            socket.emit('message', { type: 'error', message, timestamp: Date.now() });
          }
        } catch (err) {
          await logError('error', `Error in handlePrompt for ${channelName}`, err.stack, userUuid, channelName, socket.id);
        }
      });
      return;
    }

    let updateFunc, shouldPersist = true;
    switch (operation) {
      case 'add': updateFunc = updateCreateState; break;
      case 'update': updateFunc = updateUpdateState; break;
      case 'remove': updateFunc = updateDeleteState; break;
      case 'reorder': updateFunc = updateReorderState; break;
      case 'vote': updateFunc = updateVoteState; break;
      case 'draft': updateFunc = null; shouldPersist = false; break;
      default:
        socket.emit('message', { type: 'error', message: `Unknown operation: ${operation}`, timestamp: Date.now() });
        return;
    }

    if (operation === 'draft') {
      broadcastToChannel(channelName, type, normalizedPayload, userUuid);
      return;
    }

    await updateFunc(channelName, entityType, normalizedPayload);
    broadcastToChannel(channelName, type, normalizedPayload, userUuid);
  } catch (err) {
    await logError('error', `CRUD operation failed for ${channelName} and type ${type}`, err.stack, userUuid, channelName, socket.id, { payload });
    socket.emit('message', { type: 'error', message: 'Server error occurred', timestamp: Date.now() });
  }
}

function createRealTimeServers(server, corsOptions) {
  const io = new Server(server, {
    cors: corsOptions || { origin: '*' },
    pingInterval: 5000,
    pingTimeout: 10000,
    maxHttpBufferSize: 1e9,
  });

  io.on('connection', (socket) => {
    socket.on('error', (error) => {
      logError('error', `Socket error for ${socket.id}: ${error.message}`, error.stack, null, null, socket.id);
      if (error.message === 'Max buffer size exceeded') {
        socket.emit('error', 'Message too large');
      }
    });

    socket.on('join-channel', async (data) => {
      try {
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
        socket.emit('message', initStateMessage);

        broadcastToChannel(channelName, 'user-list', { id: null, userUuid, data: null });
        broadcastToChannel(channelName, 'user-joined', { id: null, userUuid, data: { displayName, color: userColor } });
      } catch (err) {
        await logError('error', `Join channel error for ${data.channelName}`, err.stack, data.userUuid, data.channelName, socket.id);
        socket.emit('message', { type: 'error', message: 'Failed to join channel', timestamp: Date.now() });
      }
    });

    socket.on('leave-channel', (data) => {
      try {
        if (!validateLeaveData(data)) return;
        cleanupUser(data.channelName, data.userUuid, socket);
      } catch (err) {
        logError('error', `Leave channel error for ${data.channelName}`, err.stack, data.userUuid, data.channelName, socket.id);
      }
    });

    socket.on('disconnect', () => {
      try {
        for (const [channelName, channel] of channels) {
          if (channel.sockets[socket.userUuid]) {
            cleanupUser(channelName, socket.userUuid, socket);
            break;
          }
        }
      } catch (err) {
        logError('error', `Disconnect error for socket ${socket.id}`, err.stack, socket.userUuid, null, socket.id);
      }
    });

    socket.on('message', async (data) => {
      try {
        await handleMessage(data, socket);
      } catch (err) {
        await logError('error', `Message handling error for socket ${socket.id}`, err.stack, data?.userUuid, data?.channelName, socket.id, { data });
        socket.emit('message', { type: 'error', message: 'Server error processing message', timestamp: Date.now() });
      }
    });
  });
}

async function handleMessage(dataObj, socket) {
  try {
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
      case 'leave-channel':
      case 'update-tab':
      case 'scroll-to-page':
        break;
      case 'add-chat':
        await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data: { ...data, color: userColor } }, socket);
        break;
      case 'draft-chat':
      case 'update-chat':
      case 'delete-chat':
      case 'add-goal':
      case 'update-goal':
      case 'remove-goal':
      case 'reorder-goals':
      case 'add-agent':
      case 'update-agent':
      case 'remove-agent':
      case 'add-clip':
      case 'remove-clip':
      case 'add-bookmark':
      case 'update-bookmark':
      case 'remove-bookmark':
      case 'add-document':
      case 'remove-document':
      case 'rename-document':
      case 'add-question':
      case 'update-question':
      case 'remove-question':
      case 'reorder-questions':
      case 'add-answer':
      case 'update-answer':
      case 'delete-answer':
      case 'vote-answer':
      case 'add-artifact':
      case 'remove-artifact':
      case 'add-transcript':
      case 'remove-transcript':
      case 'add-collab':
      case 'draft-collab':
      case 'update-collab':
      case 'delete-collab':
      case 'add-breakout':
      case 'update-breakout':
      case 'delete-breakout':
      case 'add-llm':
      case 'draft-llm':

      case 'add-section':
      case 'update-section':
      case 'remove-section':
      case 'reorder-section':

      await handleCrudOperation(channelName, userUuid, type, { id, userUuid, data }, socket);
        break;
      case 'room-lock-toggle':
        channel.locked = data.locked;
        broadcastToChannel(channelName, type, { id: null, userUuid, data: { locked: data.locked }, timestamp: dataObj.timestamp });
        for (const entityType of Object.keys(entityConfigs)) {
          const state = await loadStateFromServer(channelName, entityType);
          channel.state[entityType] = state;
        }
        break;
      case 'upload-to-cloud':
        for (const entityType of Object.keys(entityConfigs)) {
          const state = await loadStateFromServer(channelName, entityType);
          channel.state[entityType] = state;
        }
        break;
      case 'error':
        break;
      case 'unknown':
        break;
      default:
        console.warn(`Unknown message type: ${type}`);
        socket.emit('message', { type: 'error', message: `Unknown message type: ${type}`, timestamp: Date.now() });
    }
  } catch (err) {
    await logError('error', `Unhandled message error for socket ${socket.id}`, err.stack, dataObj?.userUuid, dataObj?.channelName, socket.id, { dataObj });
    socket.emit('message', { type: 'error', message: 'Server error processing message', timestamp: Date.now() });
  }
}

// Error logging function
async function logError(level, message, stackTrace, userUuid = null, channelName = null, socketId = null, details = {}) {
  try {
    const logEntry = new Log({
      timestamp: Date.now(),
      level,
      message,
      stackTrace,
      userUuid,
      channelName,
      socketId,
      details,
    });
    await logEntry.save();
    console.error(`[${level.toUpperCase()}] ${message} - Stack: ${stackTrace || 'N/A'}`);
  } catch (logErr) {
    console.error('Failed to log error:', logErr);
  }
}

module.exports = { createRealTimeServers };