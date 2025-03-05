import { useRealTime } from './useRealTime.js';

const clips = Vue.ref([]);
const bookmarks = Vue.ref([]);
const { emit, on, off } = useRealTime();

const eventHandlers = new WeakMap();

export function useClips() {
  function handleAddClip(clip) {
    console.log('handleAddClip:', clip);
    if (!clips.value.some(c => c.id === clip.id)) clips.value.push(clip);
  }

  function handleRemoveClip(id) {
    console.log('handleRemoveClip:', id);
    clips.value = clips.value.filter(c => c.id !== id);
  }

  function handleVoteClip({ clipId, direction }) {
    console.log('handleVoteClip:', { clipId, direction });
    const clip = clips.value.find(c => c.id === clipId);
    if (clip) clip.votes += direction === 'up' ? 1 : -1;
  }

  function handleAddBookmark(bookmark) {
    console.log('handleAddBookmark:', bookmark);
    if (!bookmarks.value.some(b => b.id === bookmark.id)) bookmarks.value.push(bookmark);
  }

  function handleRemoveBookmark(id) {
    console.log('handleRemoveBookmark:', id);
    bookmarks.value = bookmarks.value.filter(b => b.id !== id);
  }

  function handleSnapshot(history) {
    console.log('handleSnapshot:', history);
    clips.value = history.clips || [];
    bookmarks.value = history.bookmarks || [];
  }

  const addClipHandler = on('add-clip', handleAddClip);
  const removeClipHandler = on('remove-clip', handleRemoveClip);
  const voteClipHandler = on('vote-clip', handleVoteClip);
  const addBookmarkHandler = on('add-bookmark', handleAddBookmark);
  const removeBookmarkHandler = on('remove-bookmark', handleRemoveBookmark);
  const snapshotHandler = on('history-snapshot', handleSnapshot);

  eventHandlers.set(useClips, {
    addClip: addClipHandler,
    removeClip: removeClipHandler,
    voteClip: voteClipHandler,
    addBookmark: addBookmarkHandler,
    removeBookmark: removeBookmarkHandler,
    snapshot: snapshotHandler,
  });

  function addClip(content, documentId, location = {}) {
    console.log('addClip called:', { content, documentId, location });
    const clip = { 
      id: uuidv4(), 
      documentId, 
      content, 
      votes: 0, 
      timestamp: Date.now(), 
      location // Store offset or pageIndex
    };
    clips.value.push(clip);
    emit('add-clip', { clip });
    console.log('Emitted add-clip:', clip);
  }

  function removeClip(id) {
    clips.value = clips.value.filter(c => c.id !== id);
    emit('remove-clip', { clipId: id });
  }

  function voteClip(id, direction) {
    const clip = clips.value.find(c => c.id === id);
    if (clip) {
      clip.votes += direction === 'up' ? 1 : -1;
      emit('vote-clip', { clipId: id, direction });
    }
  }

  function addBookmark(bookmark) {
    console.log('addBookmark called:', bookmark);
    const bookmarkData = { id: uuidv4(), ...bookmark, timestamp: Date.now() };
    bookmarks.value.push(bookmarkData);
    emit('add-bookmark', { bookmark: bookmarkData });
    console.log('Emitted add-bookmark:', bookmarkData);
  }

  function removeBookmark(id) {
    bookmarks.value = bookmarks.value.filter(b => b.id !== id);
    emit('remove-bookmark', { bookmarkId: id });
  }

  function cleanup() {
    const handlers = eventHandlers.get(useClips);
    if (handlers) {
      off('add-clip', handlers.addClip);
      off('remove-clip', handlers.removeClip);
      off('vote-clip', handlers.voteClip);
      off('add-bookmark', handlers.addBookmark);
      off('remove-bookmark', handlers.removeBookmark);
      off('history-snapshot', handlers.snapshot);
      eventHandlers.delete(useClips);
    }
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