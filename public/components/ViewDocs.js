// components/ViewDocs.js
import { useSearch } from '../composables/useSearch.js';

export default {
  name: 'ViewDocs',
  props: {
    document: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const { searchQuery, searchResults, searchDocuments } = useSearch();
    const docContent = Vue.ref(null);
    const currentMatchIndex = Vue.ref(0);
    const searchMatches = Vue.ref([]);

    const performSearch = () => {
      if (!props.document || !props.document.data.processedContent) return;
      searchMatches.value = [];
      searchResults.value = [];
      currentMatchIndex.value = 0;

      if (!searchQuery.value.trim()) return;

      const keywords = searchQuery.value.toLowerCase().split(/\s+/).filter(k => k);
      if (!keywords.length) return;

      const content = props.document.data.processedContent.toLowerCase();
      const words = content.split(/\s+/);
      const matches = [];

      // Simple fuzzy search: look for keywords within 100 words of each other
      for (let i = 0; i < words.length; i++) {
        let foundKeywords = [];
        for (let j = i; j < Math.min(i + 100, words.length); j++) {
          const word = words[j];
          keywords.forEach(keyword => {
            if (word.includes(keyword) && !foundKeywords.includes(keyword)) {
              foundKeywords.push(keyword);
            }
          });
          if (foundKeywords.length === keywords.length) {
            // Found a match: extract the surrounding text (100 words around the match)
            const startIdx = Math.max(0, i - 50);
            const endIdx = Math.min(words.length, i + 50);
            const segment = words.slice(startIdx, endIdx).join(' ');
            const startCharIdx = content.indexOf(segment);
            const endCharIdx = startCharIdx + segment.length;
            matches.push({ segment, startCharIdx, endCharIdx });
            break;
          }
        }
      }

      searchMatches.value = matches;
      searchResults.value = matches.map((match, index) => ({
        id: props.document.id,
        documentName: props.document.data.name,
        segment: match.segment,
        matchIndex: index,
      }));

      if (matches.length > 0) {
        highlightMatch(0);
      }
    };

    const highlightMatch = (index) => {
      if (!docContent.value || index < 0 || index >= searchMatches.value.length) return;
      currentMatchIndex.value = index;
      const match = searchMatches.value[index];
      const content = docContent.value.innerHTML;
      const highlightedContent = content.replace(
        new RegExp(`(${match.segment})`, 'gi'),
        '<span class="bg-[#3b82f6] text-white px-1">$1</span>'
      );
      docContent.value.innerHTML = highlightedContent;

      // Scroll to the match
      const scrollContainer = docContent.value.closest('.flex-1.overflow-y-auto');
      if (scrollContainer) {
        const matchElement = docContent.value.querySelector('.bg-[#3b82f6]');
        if (matchElement) {
          matchElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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

    Vue.watch(searchQuery, () => {
      performSearch();
    });

    return {
      searchQuery,
      searchResults,
      currentMatchIndex,
      searchMatches,
      docContent,
      performSearch,
      prevMatch,
      nextMatch,
    };
  },
  template: `
    <div class="h-full flex flex-col overflow-hidden">
      <div class="p-2 bg-[#1a2233] border-b border-[#2d3748] sticky top-0 z-20 flex items-center gap-2">
        <input
          type="text"
          v-model="searchQuery"
          @input="performSearch"
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
      <div class="flex-1 overflow-y-auto">
        <div class="bg-[#1a2233] p-4 rounded-lg h-full">
          <div class="flex justify-between items-center mb-2">
            <span class="text-[#94a3b8] text-sm">{{ document.data.name }}</span>
          </div>
          <div
            ref="docContent"
            v-html="document.data.processedContent"
            class="prose text-[#e2e8f0] h-full overflow-y-auto"
          ></div>
        </div>
      </div>
    </div>
  `,
};