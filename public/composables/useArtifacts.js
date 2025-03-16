// composables/useArtifacts.js
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
        artifacts.value.push({ id, userUuid: eventUserUuid, data, timestamp });
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

  function handleRenameArtifact(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const index = artifacts.value.findIndex(a => a.id === id);
    if (index !== -1) {
      artifacts.value[index].data.name = data.name;
      artifacts.value = [...artifacts.value];
      if (selectedArtifact.value && selectedArtifact.value.id === id) {
        setSelectedArtifact({ ...selectedArtifact.value, data: { ...selectedArtifact.value.data, name: data.name } });
      }
    }
  }

  const addArtifactHandler = on('add-artifact', handleAddArtifact);
  const removeArtifactHandler = on('remove-artifact', handleRemoveArtifact);
  const renameArtifactHandler = on('update-artifact', handleRenameArtifact);

  eventHandlers.set(useArtifacts, {
    addArtifact: addArtifactHandler,
    removeArtifact: removeArtifactHandler,
    renameArtifact: renameArtifactHandler,
  });

  function addArtifact(name, pagesText, sectionId = null) {
    const uuid = uuidv4();
    const serverPayload = {
      id: uuid,
      userUuid: userUuid.value,
      data: {
        name,
        pagesText: Array.isArray(pagesText) ? pagesText : [pagesText],
        sectionId,
      },
      timestamp: Date.now(),
    };
    artifacts.value.push({ id: uuid, userUuid: userUuid.value, data: serverPayload.data, timestamp: serverPayload.timestamp });
    artifacts.value = [...artifacts.value];
    emit('add-artifact', serverPayload);
    return { id: uuid };
  }

  function updateArtifact(id, name, sectionId = null) {
    const index = artifacts.value.findIndex(a => a.id === id);
    if (index !== -1) {
      const data = { ...artifacts.value[index].data, name, sectionId };
      const payload = {
        id,
        userUuid: userUuid.value,
        data: { name, sectionId },
        timestamp: Date.now(),
      };
      artifacts.value[index].data = data;
      artifacts.value = [...artifacts.value];
      if (selectedArtifact.value && selectedArtifact.value.id === id) {
        setSelectedArtifact({ ...selectedArtifact.value, data });
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
      off('update-artifact', handlers.renameArtifact);
      eventHandlers.delete(useArtifacts);
    }
    processedEvents.clear();
  }

  return {
    artifacts,
    selectedArtifact,
    addArtifact,
    updateArtifact,
    removeArtifact,
    setSelectedArtifact,
    cleanup,
  };
}