// composables/useClips.js
import { useRealTime } from './useRealTime.js';

const clips = Vue.ref([]);
const bookmarks = Vue.ref([]);
const { userUuid, emit, on, off } = useRealTime();
const eventHandlers = new WeakMap();
const processedEvents = new Set(); // Add deduplication

export function useClips() {
  // Event handler for adding a clip
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

  // Event handler for removing a clip
  function handleRemoveClip(eventObj) {
    const { id, timestamp } = eventObj;
    clips.value = clips.value.filter(c => c.id !== id);
    clips.value = [...clips.value];
  }

  // Event handler for voting on a clip
  function handleVoteClip(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const index = clips.value.findIndex(c => c.id === id);
    if (index !== -1 && typeof data.votes === 'number') {
      clips.value[index].data.votes = data.votes;
      clips.value = [...clips.value];
    }
  }

  // Event handler for adding a bookmark
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

  // Event handler for removing a bookmark
  function handleRemoveBookmark(eventObj) {
    const { id, timestamp } = eventObj;
    bookmarks.value = bookmarks.value.filter(b => b.id !== id);
    bookmarks.value = [...bookmarks.value];
  }

  // New event handler for updating a bookmark
  function handleUpdateBookmark(eventObj) {
    const { id, data, timestamp } = eventObj;
    if (!id || !data || typeof data.name !== 'string' || data.name.trim() === '') {
      console.warn('Invalid update-bookmark data:', eventObj);
      return;
    }
    const bookmark = bookmarks.value.find(b => b.id === id);
    if (bookmark) {
      bookmark.data = { ...bookmark.data, ...data }; // Preserve existing properties, update name
      bookmarks.value = [...bookmarks.value];
    }
  }

  // Register all event handlers
  const addClipHandler = on('add-clip', handleAddClip);
  const removeClipHandler = on('remove-clip', handleRemoveClip);
  const voteClipHandler = on('vote-clip', handleVoteClip);
  const addBookmarkHandler = on('add-bookmark', handleAddBookmark);
  const removeBookmarkHandler = on('remove-bookmark', handleRemoveBookmark);
  const updateBookmarkHandler = on('update-bookmark', handleUpdateBookmark); // New handler

  // Store handlers in WeakMap for cleanup
  eventHandlers.set(useClips, {
    addClip: addClipHandler,
    removeClip: removeClipHandler,
    voteClip: voteClipHandler,
    addBookmark: addBookmarkHandler,
    removeBookmark: removeBookmarkHandler,
    updateBookmark: updateBookmarkHandler, // Added to handlers
  });

  // Function to add a new clip
  function addClip(content, documentId, location = {}) {
    const id = uuidv4();
    const data = { documentId, content, votes: 0, location };
    const payload = { id, userUuid: userUuid.value, data, timestamp: Date.now() };
    clips.value.push(payload);
    clips.value = [...clips.value];
    emit('add-clip', payload);
  }

  // Function to remove a clip
  function removeClip(id) {
    const payload = { id, userUuid: userUuid.value, data: null, timestamp: Date.now() };
    clips.value = clips.value.filter(c => c.id !== id);
    clips.value = [...clips.value];
    emit('remove-clip', payload);
  }

  // Function to vote on a clip
  function voteClip(id, direction) {
    const index = clips.value.findIndex(c => c.id === id);
    if (index !== -1) {
      const votes = clips.value[index].data.votes + (direction === 'up' ? 1 : -1);
      clips.value[index].data.votes = votes;
      clips.value = [...clips.value];
      emit('vote-clip', { id, userUuid: userUuid.value, data: { votes }, timestamp: Date.now() });
    }
  }

  // Function to add a new bookmark
  function addBookmark(bookmark) {
    const id = uuidv4();
    const data = { ...bookmark };
    const payload = { id, userUuid: userUuid.value, data, timestamp: Date.now() };
    bookmarks.value.push(payload);
    bookmarks.value = [...bookmarks.value];
    emit('add-bookmark', payload);
  }

  // Function to remove a bookmark
  function removeBookmark(id) {
    const payload = { id, userUuid: userUuid.value, data: null, timestamp: Date.now() };
    bookmarks.value = bookmarks.value.filter(b => b.id !== id);
    bookmarks.value = [...bookmarks.value];
    emit('remove-bookmark', payload);
  }

  // New function to update a bookmark's name
  function updateBookmark(id, name) {
    const bookmark = bookmarks.value.find(b => b.id === id);
    if (bookmark) {
      const payload = {
        id,
        userUuid: userUuid.value,
        data: { ...bookmark.data, name: name.trim() }, // Preserve other properties, update name
        timestamp: Date.now(),
      };
      bookmark.data = payload.data;
      bookmarks.value = [...bookmarks.value];
      emit('update-bookmark', payload);
    }
  }

  // Cleanup function to unregister all event handlers
  function cleanup() {
    const handlers = eventHandlers.get(useClips);
    if (handlers) {
      off('add-clip', handlers.addClip);
      off('remove-clip', handlers.removeClip);
      off('vote-clip', handlers.voteClip);
      off('add-bookmark', handlers.addBookmark);
      off('remove-bookmark', handlers.removeBookmark);
      off('update-bookmark', handlers.updateBookmark); // Unregister new handler
      eventHandlers.delete(useClips);
    }
    processedEvents.clear();
  }

  // Return the reactive state and functions
  return {
    clips,
    bookmarks,
    addClip,
    removeClip,
    voteClip,
    addBookmark,
    removeBookmark,
    updateBookmark, // Expose the new function
    cleanup,
  };
}