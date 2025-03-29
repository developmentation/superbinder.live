import { useRealTime } from './useRealTime.js';
import { useAgents } from './useAgents.js';
import { useLLM } from './useLLM.js';
import { useDocuments } from './useDocuments.js';
import { useGoals } from './useGoals.js';
import { useArtifacts } from './useArtifacts.js';

const breakouts = Vue.ref([]);
const collabs = Vue.ref([]);
const draftMessages = Vue.ref({});
const draftInitialTimestamps = Vue.ref({});
const currentBreakoutId = Vue.ref(null);

const { emit, on, off, activeUsers, userUuid, userColor } = useRealTime();
const { agents } = useAgents();
const { triggerLLM, llmRequests } = useLLM();
const { documents } = useDocuments();
const { goals } = useGoals();
const { addArtifact } = useArtifacts();

const eventHandlers = new WeakMap();
const processedEvents = new Set();

export function useCollaboration() {
  // Event handlers
  if (!eventHandlers.has(useCollaboration)) {
    const handlers = {};
    handlers.handleInitState = function ({ data }) {
      console.log('Received init-state for collaboration:', data);
      if (data.breakout) {
        breakouts.value = data.breakout.map(b => ({
          id: b.id,
          data: { name: b.data.name || `Breakout ${b.id.slice(0, 8)}` },
        }));
        console.log('Populated breakouts with server data:', breakouts.value);
      }
      if (data.collab) {
        collabs.value = data.collab.map(msg => ({
          id: msg.id,
          userUuid: msg.userUuid,
          data: { 
            text: msg.data.text, 
            breakoutId: msg.data.breakoutId, 
            color: msg.data.color, 
            isStreaming: msg.data.isStreaming || false, 
            agentId: msg.data.agentId,
            image: msg.data.image,
            imagePrompt: msg.data.imagePrompt // Include imagePrompt field
          },
          timestamp: msg.timestamp,
        }));
        console.log('Populated collabs:', collabs.value);
      }
      if (breakouts.value.length && !currentBreakoutId.value) {
        currentBreakoutId.value = breakouts.value[0].id;
        console.log('Set initial currentBreakoutId:', currentBreakoutId.value);
      }
    };
    handlers.handleAddCollab = function ({ id, userUuid: senderUuid, data, timestamp }) {
      console.log('Received add-collab:', { id, senderUuid, data, timestamp });
      const eventKey = `add-collab-${id}-${timestamp}`;
      if (!processedEvents.has(eventKey)) {
        processedEvents.add(eventKey);
        if (!collabs.value.some(m => m.id === id)) {
          const breakoutId = data.breakoutId;
          const finalColor = data.color || (senderUuid === userUuid.value ? userColor.value : getUserColor(senderUuid)) || '#808080';
          if (draftMessages.value[breakoutId]?.[senderUuid] && !data.isStreaming) {
            delete draftMessages.value[breakoutId][senderUuid];
            delete draftInitialTimestamps.value[breakoutId]?.[senderUuid];
          }
          collabs.value.push({
            id,
            userUuid: senderUuid,
            data: { 
              text: data.text, 
              breakoutId, 
              color: finalColor, 
              isStreaming: data.isStreaming || false, 
              agentId: data.agentId,
              image: data.image,
              imagePrompt: data.imagePrompt // Include imagePrompt field
            },
            timestamp: timestamp || Date.now(),
          });
          collabs.value = [...collabs.value];
          console.log('Updated collabs after add-collab:', collabs.value);
        }
        setTimeout(() => processedEvents.delete(eventKey), 1000);
      }
    };
    handlers.handleDraftCollab = function ({ id, userUuid: senderUuid, data, timestamp }) {
      console.log('Received draft-collab:', { id, senderUuid, data, timestamp });
      const eventKey = `draft-collab-${id}-${timestamp}`;
      if (!processedEvents.has(eventKey)) {
        processedEvents.add(eventKey);
        const breakoutId = data.breakoutId;
        if (!draftMessages.value[breakoutId]) draftMessages.value[breakoutId] = {};
        if (!draftInitialTimestamps.value[breakoutId]) draftInitialTimestamps.value[breakoutId] = {};
        const currentDraftId = draftMessages.value[breakoutId][senderUuid]?.id;
        if (!draftInitialTimestamps.value[breakoutId][senderUuid] || (currentDraftId && currentDraftId !== id)) {
          draftInitialTimestamps.value[breakoutId][senderUuid] = timestamp || Date.now();
          console.log(`New draft session for ${senderUuid} in breakout ${breakoutId}: Initial timestamp set to ${draftInitialTimestamps.value[breakoutId][senderUuid]}`);
        }
        if (data.text.trim().length > 0) {
          draftMessages.value[breakoutId][senderUuid] = {
            id,
            userUuid: senderUuid,
            data: { text: data.text, breakoutId },
            isDraft: true,
            timestamp: draftInitialTimestamps.value[breakoutId][senderUuid],
            color: '#4B5563',
            displayNameSuffix: '(typing)',
          };
        } else {
          delete draftMessages.value[breakoutId][senderUuid];
          delete draftInitialTimestamps.value[breakoutId]?.[senderUuid];
          console.log(`Removed draft for ${senderUuid} in breakout ${breakoutId}`);
        }
        draftMessages.value = { ...draftMessages.value };
        draftInitialTimestamps.value = { ...draftInitialTimestamps.value };
        setTimeout(() => processedEvents.delete(eventKey), 1000);
      }
    };
    handlers.handleDraftLLM = function ({ id, data, timestamp }) {
      console.log('Received draft-llm:', { id, data, timestamp });
      const eventKey = `draft-llm-${id}-${timestamp}`;
      if (!processedEvents.has(eventKey)) {
        processedEvents.add(eventKey);
        const message = collabs.value.find(m => m.id === id);
        if (message) {
          const content = typeof data.content === 'string' ? data.content : '';
          if (data.isImage) {
            // If this is an image response, set the image field
            message.data.image = content;
            message.data.text = message.data.imagePrompt || 'Generated Image'; // Restore the prompt or use a default
          } else {
            // For text generation, append the content
            message.data.text += content;
          }
          message.data.isStreaming = !data.end;
          collabs.value = [...collabs.value];
          console.log('Updated collab with draft LLM:', message);
          if (data.end) {
            emit('update-collab', {
              id,
              userUuid: userUuid.value,
              data: {
                text: message.data.text,
                breakoutId: message.data.breakoutId,
                color: message.data.color,
                isStreaming: false,
                agentId: message.data.agentId,
                image: message.data.image,
                imagePrompt: message.data.imagePrompt,
              },
              timestamp: message.timestamp,
            });
          }
        } else {
          console.warn(`Message ${id} not found for draft-llm`);
        }
        setTimeout(() => processedEvents.delete(eventKey), 1000);
      }
    };
    handlers.handleUpdateCollab = function ({ id, userUuid: senderUuid, data, timestamp }) {
      console.log('Received update-collab:', { id, senderUuid, data, timestamp });
      const eventKey = `update-collab-${id}-${timestamp}`;
      if (!processedEvents.has(eventKey)) {
        processedEvents.add(eventKey);
        const message = collabs.value.find(m => m.id === id);
        if (message) {
          message.data.text = data.text;
          message.data.isStreaming = data.isStreaming || false;
          message.data.image = data.image;
          message.data.imagePrompt = data.imagePrompt;
          collabs.value = [...collabs.value];
          console.log('Updated collab message:', message);
        }
        setTimeout(() => processedEvents.delete(eventKey), 1000);
      }
    };
    handlers.handleDeleteCollab = function ({ id, data }) {
      const breakoutId = data.breakoutId;
      collabs.value = collabs.value.filter(m => m.id !== id);
      collabs.value = [...collabs.value];
    };
    handlers.handleAddBreakout = function ({ id, data, timestamp }) {
      console.log('Received add-breakout:', { id, data, timestamp });
      const eventKey = `add-breakout-${id}-${timestamp}`;
      if (!processedEvents.has(eventKey)) {
        processedEvents.add(eventKey);
        if (!breakouts.value.some(r => r.id === id)) {
          breakouts.value.push({ id, data: { name: data.name } });
          breakouts.value = [...breakouts.value];
          console.log('Added breakout from server:', breakouts.value);
        }
        if (!currentBreakoutId.value) {
          currentBreakoutId.value = id;
          console.log('Set currentBreakoutId after add-breakout:', currentBreakoutId.value);
        }
        setTimeout(() => processedEvents.delete(eventKey), 1000);
      }
    };
    handlers.handleUpdateBreakout = function ({ id, data, timestamp }) {
      console.log('Received update-breakout:', { id, data, timestamp });
      const breakout = breakouts.value.find(r => r.id === id);
      if (breakout) {
        breakout.data.name = data.name;
        breakouts.value = [...breakouts.value];
        console.log('Updated breakout name from server:', { id, name: data.name });
      }
    };
    handlers.handleDeleteBreakout = function ({ id, timestamp }) {
      console.log('Received delete-breakout:', { id, timestamp });
      const eventKey = `delete-breakout-${id}-${timestamp}`;
      if (!processedEvents.has(eventKey)) {
        processedEvents.add(eventKey);
        const index = breakouts.value.findIndex(r => r.id === id);
        if (index !== -1) {
          breakouts.value.splice(index, 1);
          breakouts.value = [...breakouts.value];
          console.log('Removed breakout from breakouts:', breakouts.value);
        }
        collabs.value = collabs.value.filter(m => m.data.breakoutId !== id);
        collabs.value = [...collabs.value];
        delete draftMessages.value[id];
        delete draftInitialTimestamps.value[id];
        draftMessages.value = { ...draftMessages.value };
        draftInitialTimestamps.value = { ...draftInitialTimestamps.value };
        if (currentBreakoutId.value === id) currentBreakoutId.value = breakouts.value[0]?.id || null;
        console.log('Updated state after delete-breakout:', { breakouts: breakouts.value, collabs: collabs.value, currentBreakoutId: currentBreakoutId.value });
        setTimeout(() => processedEvents.delete(eventKey), 1000);
      }
    };

    handlers.initState = on('init-state', handlers.handleInitState);
    handlers.addCollab = on('add-collab', handlers.handleAddCollab);
    handlers.draftCollab = on('draft-collab', handlers.handleDraftCollab);
    handlers.updateCollab = on('update-collab', handlers.handleUpdateCollab);
    handlers.deleteCollab = on('delete-collab', handlers.handleDeleteCollab);
    handlers.addBreakout = on('add-breakout', handlers.handleAddBreakout);
    handlers.updateBreakout = on('update-breakout', handlers.handleUpdateBreakout);
    handlers.deleteBreakout = on('delete-breakout', handlers.handleDeleteBreakout);
    handlers.draftLLM = on('draft-llm', handlers.handleDraftLLM);
    eventHandlers.set(useCollaboration, handlers);
  }

  function sendMessage(text, breakoutId) {
    if (!text.trim() || !breakoutId) return;
    const id = uuidv4();
    const data = { text, breakoutId, color: userColor.value || '#808080' };
    collabs.value.push({
      id,
      userUuid: userUuid.value,
      data,
      timestamp: Date.now(),
    });
    collabs.value = [...collabs.value];
    console.log('Optimistically added message to collabs:', collabs.value);
    emit('add-collab', { id, userUuid: userUuid.value, data, timestamp: Date.now() });
    if (userUuid.value && !userUuid.value.startsWith('agent-')) {
      processAgentTriggers(text, breakoutId);
    }
    if (draftMessages.value[breakoutId]?.[userUuid.value]) {
      delete draftMessages.value[breakoutId][userUuid.value];
      delete draftInitialTimestamps.value[breakoutId]?.[userUuid.value];
    }
    draftMessages.value = { ...draftMessages.value };
    draftInitialTimestamps.value = { ...draftInitialTimestamps.value };
  }

  function generateImage(text, breakoutId) {
    if (!text.trim() || !breakoutId) return;
    const id = uuidv4();
    const data = { 
      text: '', // Don't overwrite with "AI is generating..."
      breakoutId, 
      color: userColor.value || '#808080', 
      isStreaming: true,
      imagePrompt: text // Store the original prompt
    };
    collabs.value.push({
      id,
      userUuid: userUuid.value,
      data,
      timestamp: Date.now(),
    });
    collabs.value = [...collabs.value];
    console.log('Optimistically added image placeholder to collabs:', collabs.value);
    emit('add-collab', { id, userUuid: userUuid.value, data, timestamp: Date.now() });
    if (userUuid.value && !userUuid.value.startsWith('agent-')) {
      processAgentTriggers(text, breakoutId, true); // Pass generateImage: true
    }
    if (draftMessages.value[breakoutId]?.[userUuid.value]) {
      delete draftMessages.value[breakoutId][userUuid.value];
      delete draftInitialTimestamps.value[breakoutId]?.[userUuid.value];
    }
    draftMessages.value = { ...draftMessages.value };
    draftInitialTimestamps.value = { ...draftInitialTimestamps.value };
  }

  function updateDraft(text, breakoutId) {
    if (!breakoutId) return;
    const draftId = draftMessages.value[breakoutId]?.[userUuid.value]?.id || uuidv4();
    emit('draft-collab', { id: draftId, userUuid: userUuid.value, data: { text: text || '', breakoutId }, timestamp: Date.now() });
  }

  function deleteMessage(id, breakoutId) {
    if (!id || !breakoutId) return;
    collabs.value = collabs.value.filter(m => m.id !== id);
    collabs.value = [...collabs.value];
    emit('delete-collab', { id, userUuid: userUuid.value, data: { breakoutId }, timestamp: Date.now() });
  }

  function addBreakout(name) {
    const id = uuidv4();
    const payload = {
      id,
      userUuid: userUuid.value,
      data: { name },
      timestamp: Date.now(),
    };
    breakouts.value.push({ id, data: { name } });
    breakouts.value = [...breakouts.value];
    console.log('Optimistically added breakout:', payload);
    emit('add-breakout', payload);
    return id;
  }

  function updateBreakout(id, name) {
    if (!id || !name) return;
    const breakout = breakouts.value.find(r => r.id === id);
    if (breakout) {
      breakout.data.name = name;
      breakouts.value = [...breakouts.value];
      console.log('Optimistically updated breakout name:', { id, name });
      emit('update-breakout', { id, userUuid: userUuid.value, data: { name }, timestamp: Date.now() });
    }
  }

  function deleteBreakout(id) {
    if (!id) return;
    const index = breakouts.value.findIndex(r => r.id === id);
    if (index !== -1) {
      breakouts.value.splice(index, 1);
      breakouts.value = [...breakouts.value];
      collabs.value = collabs.value.filter(m => m.data.breakoutId !== id);
      collabs.value = [...collabs.value];
      delete draftMessages.value[id];
      delete draftInitialTimestamps.value[id];
      draftMessages.value = { ...draftMessages.value };
      draftInitialTimestamps.value = { ...draftInitialTimestamps.value };
      if (currentBreakoutId.value === id) currentBreakoutId.value = breakouts.value[0]?.id || null;
      console.log('Optimistically deleted breakout:', { id });
      emit('delete-breakout', { id, userUuid: userUuid.value, timestamp: Date.now() });
    }
  }

  function getUserColor(senderUuid) {
    if (senderUuid === userUuid.value) return userColor.value;
    return activeUsers.value.find(user => user.userUuid === senderUuid)?.color || '#808080';
  }

  function processAgentTriggers(text, breakoutId, generateImage = false) {
    const agentMentions = text.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
    if (agentMentions.length > 0) {
      agentMentions.forEach(agentName => {
        const agent = agents.value.find(a => a.data.name === agentName);
        if (agent) triggerAgent(agent, text, breakoutId, generateImage);
      });
    } else if (generateImage) {
      // If no agent is mentioned but generateImage is true, use a default model
      triggerAgent(null, text, breakoutId, true);
    }
  }

  function triggerAgent(agent, triggerText, breakoutId, generateImage = false) {
    const messageId = uuidv4();
    const agentId = agent ? agent.id : null;
    const initialTimestamp = Date.now();
    const data = { 
      text: '', // Don't set a placeholder text
      breakoutId, 
      color: '#808080', 
      isStreaming: true, 
      agentId,
      imagePrompt: generateImage ? triggerText : undefined // Store the prompt if generating an image
    };
    collabs.value.push({
      id: messageId,
      userUuid: userUuid.value,
      data,
      timestamp: initialTimestamp,
    });
    collabs.value = [...collabs.value];
    emit('add-collab', {
      id: messageId,
      userUuid: userUuid.value,
      data,
      timestamp: initialTimestamp,
    });
    console.log('Emitted add-collab for agent placeholder:', { id: messageId, userUuid: userUuid.value, data });

    const roomMessages = collabs.value.filter(m => m.data.breakoutId === breakoutId);
    const messageHistory = [];

  if (agent) {
    messageHistory.push({ role: 'system', content: `You are participating in a multiperson chat with humans and other AI agents. Your name is @${agent.data.name}, but you don't need to write it unless you are asked your name.` });

    // Collect unique document and artifact IDs for system prompts
    const systemUniqueIds = new Set();

    // Process system prompts
    agent.data.systemPrompts.forEach(prompt => {
      if (prompt.type === 'text' && prompt.content) {
        messageHistory.push({ role: 'system', content: prompt.content });
      } else if (prompt.type === 'goal' && goals.value.some(g => g.id === prompt.content)) {
        const goal = goals.value.find(g => g.id === prompt.content);
        if (goal?.data.text) {
          messageHistory.push({ role: 'system', content: goal.data.text });
        }
      } else if (prompt.type === 'document' && documents.value.some(d => d.id === prompt.content)) {
        systemUniqueIds.add(prompt.content);
      } else if (prompt.type === 'artifact' && artifacts.value.some(a => a.id === prompt.content)) {
        systemUniqueIds.add(prompt.content);
      } else if (prompt.type === 'sections' && Array.isArray(prompt.content)) {
        prompt.content.forEach(sectionId => {
          documents.value.forEach(doc => {
            if (doc.data.sectionId === sectionId) systemUniqueIds.add(doc.id);
          });
          artifacts.value.forEach(artifact => {
            if (artifact.data.sectionId === sectionId) systemUniqueIds.add(artifact.id);
          });
        });
      }
    });

    // Add content for system prompt documents and artifacts
    systemUniqueIds.forEach(id => {
      const doc = documents.value.find(d => d.id === id);
      if (doc && doc.data.pagesText) {
        const content = Array.isArray(doc.data.pagesText) ? doc.data.pagesText.join('\n') : doc.data.pagesText;
        messageHistory.push({ role: 'system', content });
      }
      const artifact = artifacts.value.find(a => a.id === id);
      if (artifact && artifact.data.pagesText) {
        const content = Array.isArray(artifact.data.pagesText) ? artifact.data.pagesText.join('\n') : artifact.data.pagesText;
        messageHistory.push({ role: 'system', content });
      }
    });

    // Collect unique document and artifact IDs for user prompts
    const userUniqueIds = new Set();

    // Process user prompts
    agent.data.userPrompts.forEach(prompt => {
      if (prompt.type === 'text' && prompt.content) {
        messageHistory.push({ role: 'user', content: prompt.content });
      } else if (prompt.type === 'goal' && goals.value.some(g => g.id === prompt.content)) {
        const goal = goals.value.find(g => g.id === prompt.content);
        if (goal?.data.text) {
          messageHistory.push({ role: 'user', content: goal.data.text });
        }
      } else if (prompt.type === 'document' && documents.value.some(d => d.id === prompt.content)) {
        userUniqueIds.add(prompt.content);
      } else if (prompt.type === 'artifact' && artifacts.value.some(a => a.id === prompt.content)) {
        userUniqueIds.add(prompt.content);
      } else if (prompt.type === 'sections' && Array.isArray(prompt.content)) {
        prompt.content.forEach(sectionId => {
          documents.value.forEach(doc => {
            if (doc.data.sectionId === sectionId) userUniqueIds.add(doc.id);
          });
          artifacts.value.forEach(artifact => {
            if (artifact.data.sectionId === sectionId) userUniqueIds.add(artifact.id);
          });
        });
      }
    });

    // Add content for user prompt documents and artifacts
    userUniqueIds.forEach(id => {
      const doc = documents.value.find(d => d.id === id);
      if (doc && doc.data.pagesText) {
        const content = Array.isArray(doc.data.pagesText) ? doc.data.pagesText.join('\n') : doc.data.pagesText;
        messageHistory.push({ role: 'user', content });
      }
      const artifact = artifacts.value.find(a => a.id === id);
      if (artifact && artifact.data.pagesText) {
        const content = Array.isArray(artifact.data.pagesText) ? artifact.data.pagesText.join('\n') : artifact.data.pagesText;
        messageHistory.push({ role: 'user', content });
      }
    });
  } else {
    // Default system prompt for image generation without an agent
    messageHistory.push({ role: 'system', content: 'You are an AI capable of generating images based on user prompts.' });
  }

    const chatHistory = roomMessages.map(m => ({
      role: m.data.agentId ? 'user' : 'user',
      content: m.data.text,
    }));
    messageHistory.push(...chatHistory);

    // Concatenate all system prompts into a single system prompt
    const systemContent = messageHistory.filter(m => m.role === 'system').map(m => m.content).join('\n');
    let cleanedMessageHistory = [
      { role: 'system', content: systemContent },
      ...messageHistory.filter(m => m.role !== 'system')
    ];

    // Remove empty string prompts, not supported by some LLMs like Grok
    cleanedMessageHistory = cleanedMessageHistory.filter(m => m.content !== '');

    console.log('Chat History:', chatHistory);
    console.log('LLM Payload:', { cleanedMessageHistory });

    // Use agent's model if available, otherwise default to Gemini for image generation
    const model = agent 
      ? (agent.data.model || { provider: 'gemini', model: 'gemini-2.0-flash-exp-image-generation', name: 'gemini-2.0-flash' })
      : { provider: 'gemini', model: 'gemini-2.0-flash-exp-image-generation', name: 'gemini-2.0-flash' };

    triggerLLM(
      messageId,
      model,
      0.5,
      systemContent,
      triggerText,
      cleanedMessageHistory,
      false,
      generateImage // Pass the generateImage flag
    );
  }

  function cleanup() {
    const handlers = eventHandlers.get(useCollaboration);
    if (handlers) {
      off('init-state', handlers.initState);
      off('add-collab', handlers.addCollab);
      off('draft-collab', handlers.draftCollab);
      off('update-collab', handlers.updateCollab);
      off('delete-collab', handlers.deleteCollab);
      off('add-breakout', handlers.addBreakout);
      off('update-breakout', handlers.updateBreakout);
      off('delete-breakout', handlers.deleteBreakout);
      off('draft-llm', handlers.draftLLM);
      eventHandlers.delete(useCollaboration);
    }
    processedEvents.clear();
    draftInitialTimestamps.value = {};
  }

  return {
    breakouts,
    collabs,
    draftMessages,
    draftInitialTimestamps,
    currentBreakoutId,
    sendMessage,
    generateImage,
    updateDraft,
    deleteMessage,
    addBreakout,
    updateBreakout,
    deleteBreakout,
    cleanup,
    activeUsers,
  };
}