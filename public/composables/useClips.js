// composables/useClips.js
import { useRealTime } from './useRealTime.js';

const clips = Vue.ref([]);
const bookmarks = Vue.ref([]);
const { userUuid, emit, on, off } = useRealTime();
const eventHandlers = new WeakMap();
const processedEvents = new Set(); // Add deduplication

export function useClips() {
  function handleAddClip(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-clip-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!clips.value.some(c => c.id === id)) {
        clips.value.push({ id, userUuid: eventUserUuid, data });
        clips.value = [...clips.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  function handleRemoveClip(eventObj) {
    const { id, timestamp } = eventObj;
    clips.value = clips.value.filter(c => c.id !== id);
    clips.value = [...clips.value];
  }

  function handleVoteClip(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const index = clips.value.findIndex(c => c.id === id);
    if (index !== -1 && typeof data.votes === 'number') {
      clips.value[index].data.votes = data.votes;
      clips.value = [...clips.value];
    }
  }

  function handleAddBookmark(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-bookmark-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!bookmarks.value.some(b => b.id === id)) {
        bookmarks.value.push({ id, userUuid: eventUserUuid, data });
        bookmarks.value = [...bookmarks.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  function handleRemoveBookmark(eventObj) {
    const { id, timestamp } = eventObj;
    bookmarks.value = bookmarks.value.filter(b => b.id !== id);
    bookmarks.value = [...bookmarks.value];
  }

  const addClipHandler = on('add-clip', handleAddClip);
  const removeClipHandler = on('remove-clip', handleRemoveClip);
  const voteClipHandler = on('vote-clip', handleVoteClip);
  const addBookmarkHandler = on('add-bookmark', handleAddBookmark);
  const removeBookmarkHandler = on('remove-bookmark', handleRemoveBookmark);

  eventHandlers.set(useClips, {
    addClip: addClipHandler,
    removeClip: removeClipHandler,
    voteClip: voteClipHandler,
    addBookmark: addBookmarkHandler,
    removeBookmark: removeBookmarkHandler,
  });

  function addClip(content, documentId, location = {}) {
    const id = uuidv4();
    const data = { documentId, content, votes: 0, location };
    const payload = { id, userUuid: userUuid.value, data, timestamp: Date.now() };
    clips.value.push(payload);
    clips.value = [...clips.value];
    emit('add-clip', payload);
  }

  function removeClip(id) {
    const payload = { id, userUuid: userUuid.value, data: null, timestamp: Date.now() };
    clips.value = clips.value.filter(c => c.id !== id);
    clips.value = [...clips.value];
    emit('remove-clip', payload);
  }

  function voteClip(id, direction) {
    const index = clips.value.findIndex(c => c.id === id);
    if (index !== -1) {
      const votes = clips.value[index].data.votes + (direction === 'up' ? 1 : -1);
      clips.value[index].data.votes = votes;
      clips.value = [...clips.value];
      emit('vote-clip', { id, userUuid: userUuid.value, data: { votes }, timestamp: Date.now() });
    }
  }

  function addBookmark(bookmark) {
    const id = uuidv4();
    const data = { ...bookmark };
    const payload = { id, userUuid: userUuid.value, data, timestamp: Date.now() };
    bookmarks.value.push(payload);
    bookmarks.value = [...bookmarks.value];
    emit('add-bookmark', payload);
  }

  function removeBookmark(id) {
    const payload = { id, userUuid: userUuid.value, data: null, timestamp: Date.now() };
    bookmarks.value = bookmarks.value.filter(b => b.id !== id);
    bookmarks.value = [...bookmarks.value];
    emit('remove-bookmark', payload);
  }

  function cleanup() {
    const handlers = eventHandlers.get(useClips);
    if (handlers) {
      off('add-clip', handlers.addClip);
      off('remove-clip', handlers.removeClip);
      off('vote-clip', handlers.voteClip);
      off('add-bookmark', handlers.addBookmark);
      off('remove-bookmark', handlers.removeBookmark);
      eventHandlers.delete(useClips);
    }
    processedEvents.clear();
  }

  return {
    clips,
    bookmarks,
    addClip,
    removeClip,
    voteClip,
    addBookmark,
    removeBookmark,
    cleanup,
  };
}