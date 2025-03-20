// ./composables/useArtifacts.js
import { useRealTime } from './useRealTime.js';

const artifacts = Vue.ref([]);
const selectedArtifact = Vue.ref(null);
const { userUuid, emit, on, off } = useRealTime();
const eventHandlers = new WeakMap();
const processedEvents = new Set();

export function useArtifacts() {
  function setSelectedArtifact(artifact) {
    selectedArtifact.value = artifact ? { ...artifact } : null;
  }

  function handleAddArtifact(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-artifact-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!artifacts.value.some(a => a.id === id)) {
        artifacts.value.push({ id, userUuid: eventUserUuid, data });
        artifacts.value = [...artifacts.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  function handleRemoveArtifact(eventObj) {
    const { id, timestamp } = eventObj;
    artifacts.value = artifacts.value.filter(a => a.id !== id);
    if (selectedArtifact.value && selectedArtifact.value.id === id) {
      setSelectedArtifact(null);
    }
  }

  function handleUpdateArtifact(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    console.log('handleUpdateArtifact:', { id, userUuid: eventUserUuid, data, timestamp }); // Debug
    const index = artifacts.value.findIndex(a => a.id === id);
    if (index !== -1) {
      artifacts.value[index].data = { ...artifacts.value[index].data, ...data };
      artifacts.value = [...artifacts.value];
      if (selectedArtifact.value && selectedArtifact.value.id === id) {
        setSelectedArtifact({ ...selectedArtifact.value, data: artifacts.value[index].data });
      }
      console.log('Updated artifact:', artifacts.value[index]); // Debug
    }
  }

  const addArtifactHandler = on('add-artifact', handleAddArtifact);
  const removeArtifactHandler = on('remove-artifact', handleRemoveArtifact);
  const updateArtifactHandler = on('update-artifact', handleUpdateArtifact);

  eventHandlers.set(useArtifacts, {
    addArtifact: addArtifactHandler,
    removeArtifact: removeArtifactHandler,
    updateArtifact: updateArtifactHandler,
  });

  function addArtifact(name, pagesText, sectionId = null) {
    const uuid = uuidv4();
    const serverPayload = {
      id: uuid,
      userUuid: userUuid.value,
      data: { name, pagesText, sectionId, type: 'md' }, // Added type: 'md'
      timestamp: Date.now(),
    };
    artifacts.value.push({ id: uuid, userUuid: userUuid.value, data: { name, pagesText, sectionId, type: 'md' } });
    artifacts.value = [...artifacts.value];
    emit('add-artifact', serverPayload);
    return { id: uuid };
  }

  function updateArtifact(id, updates) {
    console.log('updateArtifact called:', { id, updates }); // Debug
    const index = artifacts.value.findIndex(a => a.id === id);
    if (index !== -1) {
      const updatedData = { ...artifacts.value[index].data, ...updates };
      const payload = {
        id,
        userUuid: userUuid.value,
        data: updatedData,
        timestamp: Date.now(),
      };
      artifacts.value[index].data = updatedData;
      artifacts.value = [...artifacts.value];
      if (selectedArtifact.value && selectedArtifact.value.id === id) {
        setSelectedArtifact({ ...selectedArtifact.value, data: updatedData });
      }
      emit('update-artifact', payload);
    }
  }

  function removeArtifact(id) {
    const payload = {
      id,
      userUuid: userUuid.value,
      data: null,
      timestamp: Date.now(),
    };
    artifacts.value = artifacts.value.filter(a => a.id !== id);
    artifacts.value = [...artifacts.value];
    emit('remove-artifact', payload);
    if (selectedArtifact.value && selectedArtifact.value.id === id) {
      setSelectedArtifact(null);
    }
  }

  function cleanup() {
    const handlers = eventHandlers.get(useArtifacts);
    if (handlers) {
      off('add-artifact', handlers.addArtifact);
      off('remove-artifact', handlers.removeArtifact);
      off('update-artifact', handlers.updateArtifact);
      eventHandlers.delete(useArtifacts);
    }
    processedEvents.clear();
  }

  return {
    artifacts,
    selectedArtifact,
    addArtifact,
    removeArtifact,
    updateArtifact,
    setSelectedArtifact,
    cleanup,
  };
}