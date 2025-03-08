// composables/useAgents.js
import { useRealTime } from './useRealTime.js';

const agents = Vue.ref([]);
const { userUuid, displayName, emit, on, off } = useRealTime();
const eventHandlers = new WeakMap();
const processedEvents = new Set(); // Add deduplication like useGoals

export function useAgents() {
  function handleAddAgent(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-agent-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!agents.value.some(a => a.id === id)) {
        agents.value.push({ id, userUuid: eventUserUuid, data });
        agents.value = [...agents.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  function handleUpdateAgent(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const index = agents.value.findIndex(a => a.id === id);
    if (index !== -1) {
      agents.value[index] = { id, userUuid: eventUserUuid, data };
      agents.value = [...agents.value];
    } else {
      console.warn(`Agent with ID ${id} not found for update, adding as new`);
      agents.value.push({ id, userUuid: eventUserUuid, data });
      agents.value = [...agents.value];
    }
  }

  function handleRemoveAgent(eventObj) {
    const { id, timestamp } = eventObj;
    agents.value = agents.value.filter(a => a.id !== id);
    agents.value = [...agents.value];
  }

  const addAgentHandler = on('add-agent', handleAddAgent);
  const updateAgentHandler = on('update-agent', handleUpdateAgent);
  const removeAgentHandler = on('remove-agent', handleRemoveAgent);

  eventHandlers.set(useAgents, {
    add: addAgentHandler,
    update: updateAgentHandler,
    remove: removeAgentHandler,
  });

  function addAgent(name, description, imageUrl, systemPrompts = [], userPrompts = []) {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new Error('Agent name must contain only letters, numbers, or underscores, with no spaces.');
    }
    const id = uuidv4();
    const data = {
      name,
      createdBy: displayName.value,
      description,
      imageUrl,
      systemPrompts: systemPrompts.map(prompt => ({
        id: prompt.id || uuidv4(),
        type: prompt.type || 'text',
        content: prompt.content || '',
      })),
      userPrompts: userPrompts.map(prompt => ({
        id: prompt.id || uuidv4(),
        type: prompt.type || 'text',
        content: prompt.content || '',
      })),
    };
    const payload = {
      id,
      userUuid: userUuid.value,
      data,
      timestamp: Date.now(),
    };
    agents.value.push(payload);
    agents.value = [...agents.value];
    emit('add-agent', payload);
  }

  function updateAgent(id, name, description, imageUrl, systemPrompts, userPrompts) {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new Error('Agent name must contain only letters, numbers, or underscores, with no spaces.');
    }
    const data = {
      name,
      createdBy: displayName.value,
      description,
      imageUrl,
      systemPrompts: systemPrompts.map(prompt => ({
        id: prompt.id || uuidv4(),
        type: prompt.type || 'text',
        content: prompt.content || '',
      })),
      userPrompts: userPrompts.map(prompt => ({
        id: prompt.id || uuidv4(),
        type: prompt.type || 'text',
        content: prompt.content || '',
      })),
    };
    const payload = {
      id,
      userUuid: userUuid.value,
      data,
      timestamp: Date.now(),
    };
    const index = agents.value.findIndex(a => a.id === id);
    if (index !== -1) {
      agents.value[index] = payload;
      agents.value = [...agents.value];
    } else {
      agents.value.push(payload);
      agents.value = [...agents.value];
    }
    emit('update-agent', payload);
  }

  function removeAgent(id) {
    const payload = {
      id,
      userUuid: userUuid.value,
      data: null,
      timestamp: Date.now(),
    };
    agents.value = agents.value.filter(a => a.id !== id);
    agents.value = [...agents.value];
    emit('remove-agent', payload);
  }

  function cleanup() {
    const handlers = eventHandlers.get(useAgents);
    if (handlers) {
      off('add-agent', handlers.add);
      off('update-agent', handlers.update);
      off('remove-agent', handlers.remove);
      eventHandlers.delete(useAgents);
    }
    processedEvents.clear();
  }

  return { agents, addAgent, updateAgent, removeAgent, cleanup };
}