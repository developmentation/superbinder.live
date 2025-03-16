import { useSearch } from '../composables/useSearch.js';

// Assuming 'marked' is globally accessible

export default {
  name: 'ViewDocs',
  props: {
    document: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const { searchQuery, searchResults } = useSearch();
    const currentMatchIndex = Vue.ref(0);
    const searchMatches = Vue.ref([]);
    const debouncedSearchQuery = Vue.ref('');
    const scrollContainer = Vue.ref(null);
    const contentContainer = Vue.ref(null);

    // Debounce the search query to reduce re-computations
    const debounce = (fn, delay) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    };

    const updateDebouncedSearch = debounce((value) => {
      debouncedSearchQuery.value = value;
    }, 300);

    Vue.watch(searchQuery, (newValue) => {
      updateDebouncedSearch(newValue);
    });

    // Compute the rendered Markdown content
    const renderedContent = Vue.computed(() => {
      if (!props.document || !props.document.data.processedContent) {
        return '';
      }
      return marked.parse(props.document.data.processedContent);
    });

    // Perform search and store match positions
    const updateSearchMatches = () => {
      if (!contentContainer.value || !debouncedSearchQuery.value.trim()) {
        searchMatches.value = [];
        searchResults.value = [];
        currentMatchIndex.value = 0;
        clearHighlights();
        return;
      }

      const searchTerm = debouncedSearchQuery.value;
      const walker = document.createTreeWalker(
        contentContainer.value,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'CODE') {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      const matches = [];
      let matchIndex = 0;
      let node;

      while ((node = walker.nextNode())) {
        const text = node.nodeValue;
        let match;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
          const start = match.index;
          const end = regex.lastIndex;
          matches.push({
            textNode: node,
            start,
            end,
            segment: match[0],
            matchIndex,
          });
          matchIndex++;
        }
      }

      searchMatches.value = matches;
      searchResults.value = matches.map((match) => ({
        id: props.document.id,
        documentName: props.document.data.name,
        segment: match.segment,
        matchIndex: match.matchIndex,
      }));

      if (matches.length > 0) {
        try {
          applyHighlights();
          highlightMatch(0);
        } catch (error) {
          console.error('Failed to apply highlights:', error);
          clearHighlights();
        }
      } else {
        clearHighlights();
      }
    };

    // Apply highlights by splitting text nodes
    const applyHighlights = () => {
      clearHighlights();
      const processedNodes = new WeakMap(); // Track processed text nodes and their offsets

      searchMatches.value.forEach((match) => {
        const textNode = match.textNode;
        const textLength = textNode.nodeValue.length;

        // Validate the range
        if (match.start < 0 || match.end > textLength || match.start >= match.end) {
          console.warn('Invalid range for highlight:', match);
          return;
        }

        // Check if this text node has been processed
        if (!processedNodes.has(textNode)) {
          processedNodes.set(textNode, 0);
        }

        const parent = textNode.parentNode;
        const text = textNode.nodeValue;
        let currentOffset = processedNodes.get(textNode);

        // Adjust start and end based on previous highlights in this node
        const adjustedStart = match.start + currentOffset;
        const adjustedEnd = match.end + currentOffset;

        if (adjustedStart >= textLength || adjustedEnd > textLength) {
          console.warn('Adjusted range exceeds text length:', match, { adjustedStart, adjustedEnd, textLength });
          return;
        }

        // Split the text node into three parts
        const beforeText = text.slice(0, adjustedStart);
        const matchText = text.slice(adjustedStart, adjustedEnd);
        const afterText = text.slice(adjustedEnd);

        // Create nodes for each part
        const beforeNode = beforeText ? document.createTextNode(beforeText) : null;
        const matchNode = document.createElement('span');
        matchNode.className = `highlight-${match.matchIndex} inline highlight-blue`;
        matchNode.textContent = matchText;
        const afterNode = afterText ? document.createTextNode(afterText) : null;

        // Replace the original text node with the new nodes
        if (beforeNode) parent.insertBefore(beforeNode, textNode);
        parent.insertBefore(matchNode, textNode);
        if (afterNode) parent.insertBefore(afterNode, textNode);
        parent.removeChild(textNode);

        // Update the offset for the next match in this node
        processedNodes.set(textNode, currentOffset + matchText.length);
      });
    };

    // Clear existing highlights
    const clearHighlights = () => {
      if (!contentContainer.value) return;
      const highlights = contentContainer.value.querySelectorAll('span[class^="highlight-"]');
      highlights.forEach((span) => {
        const parent = span.parentNode;
        const textNode = document.createTextNode(span.textContent);
        parent.replaceChild(textNode, span);
      });
    };

    const highlightMatch = (index) => {
      if (index < 0 || index >= searchMatches.value.length) return;
      currentMatchIndex.value = index;

      Vue.nextTick(() => {
        if (scrollContainer.value && contentContainer.value) {
          const highlightElement = contentContainer.value.querySelector(`.highlight-${index}`);
          if (highlightElement) {
            const headerHeight = document.querySelector('.sticky.top-0')?.offsetHeight || 0;
            const containerRect = scrollContainer.value.getBoundingClientRect();
            const elementRect = highlightElement.getBoundingClientRect();
            const scrollTop = scrollContainer.value.scrollTop;
            const offsetPosition = elementRect.top - containerRect.top + scrollTop - headerHeight - 10;

            scrollContainer.value.scrollTo({
              top: offsetPosition,
              behavior: 'smooth',
            });

            // Apply current match styling
            clearCurrentMatchStyle();
            highlightElement.classList.add('highlight-yellow');
            highlightElement.classList.remove('highlight-blue');
          }
        }
      });
    };

    const clearCurrentMatchStyle = () => {
      if (!contentContainer.value) return;
      const currentHighlight = contentContainer.value.querySelector('.highlight-yellow');
      if (currentHighlight) {
        currentHighlight.classList.remove('highlight-yellow');
        currentHighlight.classList.add('highlight-blue');
      }
    };

    const prevMatch = () => {
      if (searchMatches.value.length === 0) return;
      const newIndex = (currentMatchIndex.value - 1 + searchMatches.value.length) % searchMatches.value.length;
      highlightMatch(newIndex);
    };

    const nextMatch = () => {
      if (searchMatches.value.length === 0) return;
      const newIndex = (currentMatchIndex.value + 1) % searchMatches.value.length;
      highlightMatch(newIndex);
    };

    Vue.watch(debouncedSearchQuery, () => {
      try {
        updateSearchMatches();
      } catch (error) {
        console.error('Error in debouncedSearchQuery watcher:', error);
      }
    });

    Vue.watch(
      () => props.document.data.processedContent,
      () => {
        try {
          updateSearchMatches();
        } catch (error) {
          console.error('Error in processedContent watcher:', error);
        }
      },
      { immediate: true }
    );

    Vue.onMounted(() => {
      Vue.nextTick(() => {
        try {
          updateSearchMatches();
        } catch (error) {
          console.error('Error on mount:', error);
        }
      });
    });

    Vue.onUnmounted(() => {
      clearHighlights();
    });

    return {
      searchQuery,
      searchResults,
      currentMatchIndex,
      searchMatches,
      renderedContent,
      prevMatch,
      nextMatch,
      scrollContainer,
      contentContainer,
    };
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <div class="p-2 bg-[#1a2233] border-b border-[#2d3748] sticky top-0 z-20 flex items-center gap-2">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search document..."
          class="flex-1 p-2 bg-[#2d3748] text-[#e2e8f0] rounded-lg border border-[#4b5563] focus:border-[#4dabf7] focus:outline-none text-sm"
        />
        <div class="flex items-center gap-2 text-[#94a3b8] text-sm">
          <span>{{ searchMatches.length ? currentMatchIndex + 1 : 0 }} / {{ searchMatches.length }}</span>
          <button
            @click="prevMatch"
            :disabled="!searchMatches.length"
            class="py-1 px-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg disabled:bg-[#4b5563] disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <button
            @click="nextMatch"
            :disabled="!searchMatches.length"
            class="py-1 px-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg disabled:bg-[#4b5563] disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
      <div ref="scrollContainer" class="flex-1 overflow-y-auto">
        <div class="bg-[#1a2233] p-4 rounded-lg h-full">
          <div class="flex justify-between items-center mb-2">
            <span class="text-[#94a3b8] text-sm">{{ document.data.name }}</span>
          </div>
          <div ref="contentContainer" class="prose text-[#e2e8f0] h-full overflow-y-auto" v-html="renderedContent"></div>
        </div>
      </div>
    </div>
  `,
};