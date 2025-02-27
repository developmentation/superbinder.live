// composables/useSearch.js
import { useDocuments } from './useDocuments.js';

const searchQuery = Vue.ref('');
const searchResults = Vue.ref([]);

export function useSearch() {
  const { documents } = useDocuments();

  function searchDocuments(query) {
    searchQuery.value = query;
    searchResults.value = [];

    const keywords = query.toLowerCase().split(/\s+/).filter(k => k);
    if (!keywords.length) return;

    documents.value.forEach(doc => {
      const content = doc.originalContent.toLowerCase();
      const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s);

      sentences.forEach(sentence => {
        const words = sentence.split(/\W+/).filter(w => w);
        const matches = keywords.filter(kw => words.includes(kw));

        if (matches.length >= Math.min(keywords.length, 2)) { // Match at least 2 keywords or all if fewer
          const startIdx = Math.max(0, content.indexOf(sentence) - 50);
          const endIdx = Math.min(content.length, content.indexOf(sentence) + sentence.length + 50);
          const segment = content.substring(startIdx, endIdx);

          searchResults.value.push({
            documentId: doc.id,
            documentName: doc.name,
            segment,
            matches,
            timestamp: Date.now(),
          });
        }
      });
    });

    // Sort by relevance (more matches = higher rank)
    searchResults.value.sort((a, b) => b.matches.length - a.matches.length);
  }

  return { searchQuery, searchResults, searchDocuments };
}