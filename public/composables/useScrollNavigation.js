// composables/useScrollNavigation.js
import { useRealTime } from './useRealTime.js';

let jumpToPageNumber = Vue.ref(0)

export function useScrollNavigation() {
  const { emit, on, off } = useRealTime();
  const scrollToPageIndex = Vue.ref(null);
  let scrollHandler = null;

  // Emit a scroll request
  function requestScrollToPage(pageIndex) {
    console.log(`Requesting scroll to page index: ${pageIndex}`);
    emit('scroll-to-page', pageIndex);
  }

  // Listen for scroll requests
  function onScrollRequest(callback) {
    scrollHandler = (pageIndex) => {
      console.log(`Received scroll request for page index: ${pageIndex}`);
      callback(pageIndex);
    };
    on('scroll-to-page', scrollHandler);
  }

  // Cleanup listener
  function cleanup() {
    if (scrollHandler) {
      off('scroll-to-page', scrollHandler);
      scrollHandler = null;
    }
  }

  return {
    scrollToPageIndex, // Still expose for compatibility, but not used directly
    requestScrollToPage,
    onScrollRequest,
    cleanup,
    jumpToPageNumber
  };
}