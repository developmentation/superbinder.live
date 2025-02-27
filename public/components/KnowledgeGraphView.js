// components/KnowledgeGraphView.js
import KnowledgeGraphComponent from './KnowledgeGraphComponent.js';

export default {
  name: 'KnowledgeGraphView',
  template: `
    <div class="min-h-screen bg-gray-800 pb-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 class="text-3xl font-bold text-purple-400 mb-6">Knowledge Graph Generator</h1>
        <p class="text-gray-300 mb-8">
          Upload PDF documents to automatically create an interactive knowledge graph that visualizes the relationships between concepts, entities, and ideas.
        </p>
        
        <KnowledgeGraphComponent />
      </div>
    </div>
  `,
  components: {
    KnowledgeGraphComponent
  }
};