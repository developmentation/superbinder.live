// src/components/KnowledgeGraphComponent.js

import * as d3 from 'd3';
import { knowledgeGraphService } from '../services/knowledgeGraphService.js';

export default {
  name: 'KnowledgeGraphComponent',
  template: `
    <div class="knowledge-graph-container">
      <div class="upload-section">
        <h2 class="text-xl font-semibold text-purple-400 mb-4">PDF Knowledge Graph Generator</h2>
        <input type="file" ref="fileInput" @change="handleFileUpload" accept="application/pdf" class="mb-4 p-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
        <button @click="processPdf" :disabled="!selectedFile || isProcessing" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
          {{ isProcessing ? 'Processing...' : 'Process PDF' }}
        </button>
      </div>

      <div v-if="status" class="status-section mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <p class="text-white">{{ status }}</p>
        <div v-if="isProcessing" class="progress-bar mt-2 bg-gray-700 rounded-full overflow-hidden">
          <div class="progress bg-purple-600 h-2" :style="{ width: \`\${processingProgress}%\` }"></div>
        </div>
      </div>

      <div v-if="graphData.nodes.length > 0" class="graph-section mt-6">
        <div class="controls p-2 bg-gray-800 rounded-lg border border-gray-700 mb-4 flex gap-2">
          <button @click="zoomIn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Zoom In</button>
          <button @click="zoomOut" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Zoom Out</button>
          <button @click="resetZoom" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Reset View</button>
          <select v-model="selectedLayout" @change="updateLayout" class="px-3 py-1 bg-gray-700 text-white rounded-lg border border-gray-600">
            <option value="force">Force Directed</option>
            <option value="circular">Circular</option>
            <option value="hierarchical">Hierarchical</option>
          </select>
        </div>
        <div ref="graphContainer" class="graph-container w-full border border-gray-700 rounded-lg overflow-hidden bg-gray-900"></div>
      </div>

      <div v-if="selectedNode" class="info-panel fixed top-5 right-5 w-72 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg z-10">
        <h3 class="text-lg font-semibold text-purple-400">{{ selectedNode.label }}</h3>
        <p v-if="selectedNode.type" class="text-white mt-2">Type: {{ selectedNode.type }}</p>
        <div v-if="selectedNode.properties" class="mt-2">
          <p class="text-white">Properties:</p>
          <ul class="mt-1 text-gray-300">
            <li v-for="(value, key) in selectedNode.properties" :key="key" class="ml-4">
              {{ key }}: {{ value }}
            </li>
          </ul>
        </div>
        <button @click="closeInfoPanel" class="mt-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg">Close</button>
      </div>
    </div>
  `,
  setup() {
    // State variables
    const fileInput = Vue.ref(null);
    const selectedFile = Vue.ref(null);
    const isProcessing = Vue.ref(false);
    const status = Vue.ref('');
    const processingProgress = Vue.ref(0);
    const graphContainer = Vue.ref(null);
    const graphData = Vue.ref({ nodes: [], links: [] });
    const selectedNode = Vue.ref(null);
    const selectedLayout = Vue.ref('force');
    const simulation = Vue.ref(null);
    const svg = Vue.ref(null);
    const zoom = Vue.ref(null);

    // Function to handle file upload
    const handleFileUpload = (event) => {
      const file = event.target.files[0];
      if (file && file.type === 'application/pdf') {
        selectedFile.value = file;
        status.value = `File selected: ${file.name}`;
      } else {
        status.value = 'Please select a PDF file.';
      }
    };

    // Progress callback for the service
    const progressCallback = (type, value) => {
      if (type === 'status' || type === 'extracting' || type === 'storing') {
        status.value = value;
      } else if (type === 'progress') {
        processingProgress.value = value;
      } else if (type === 'error') {
        status.value = `Error: ${value}`;
      }
    };

    // Main function to process PDF
    const processPdf = async () => {
      if (!selectedFile.value) {
        status.value = 'Please select a PDF file first.';
        return;
      }

      try {
        isProcessing.value = true;
        
        // Process the PDF using the service
        const result = await knowledgeGraphService.processPdf(
          selectedFile.value, 
          progressCallback
        );
        
        // Update graph data
        graphData.value = result;
        
        // Render the graph
        renderGraph();
      } catch (error) {
        console.error('Error processing PDF:', error);
        status.value = `Error: ${error.message}`;
      } finally {
        isProcessing.value = false;
      }
    };

    // Function to render the graph using D3.js
    const renderGraph = () => {
      if (!graphContainer.value) return;
      
      const width = graphContainer.value.clientWidth;
      const height = graphContainer.value.clientHeight || 600;
      
      // Clear previous graph
      d3.select(graphContainer.value).selectAll('*').remove();
      
      // Create SVG
      svg.value = d3.select(graphContainer.value)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .attr('style', 'max-width: 100%; height: auto; font: 12px sans-serif;');
      
      // Create zoom behavior
      zoom.value = d3.zoom()
        .scaleExtent([0.1, 8])
        .on('zoom', (event) => {
          container.attr('transform', event.transform);
        });
      
      svg.value.call(zoom.value);
      
      // Container for the graph
      const container = svg.value.append('g');
      
      // Reset zoom
      svg.value.call(zoom.value.transform, d3.zoomIdentity);
      
      // Create links
      const link = container.append('g')
        .selectAll('line')
        .data(graphData.value.links)
        .join('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1.5);
      
      // Create link labels
      const linkLabels = container.append('g')
        .selectAll('text')
        .data(graphData.value.links)
        .join('text')
        .text(d => d.type)
        .attr('font-size', '8px')
        .attr('fill', '#ccc')
        .attr('text-anchor', 'middle');
      
      // Create nodes
      const node = container.append('g')
        .selectAll('circle')
        .data(graphData.value.nodes)
        .join('circle')
        .attr('r', 8)
        .attr('fill', d => getNodeColor(d.type))
        .call(drag(simulation.value))
        .on('click', (event, d) => {
          event.stopPropagation();
          selectedNode.value = d;
        });
      
      // Node labels
      const labels = container.append('g')
        .selectAll('text')
        .data(graphData.value.nodes)
        .join('text')
        .text(d => d.label)
        .attr('font-size', '10px')
        .attr('fill', '#fff')
        .attr('dx', 12)
        .attr('dy', 4);
      
      // Create simulation
      simulation.value = d3.forceSimulation(graphData.value.nodes)
        .force('link', d3.forceLink(graphData.value.links)
          .id(d => d.id)
          .distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .on('tick', () => {
          link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
          
          linkLabels
            .attr('x', d => (d.source.x + d.target.x) / 2)
            .attr('y', d => (d.source.y + d.target.y) / 2);
          
          node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
          
          labels
            .attr('x', d => d.x)
            .attr('y', d => d.y);
        });
      
      // Click on background to deselect node
      svg.value.on('click', () => {
        selectedNode.value = null;
      });
    };
    
    // Function to get color based on node type
    const getNodeColor = (type) => {
      const colors = {
        Person: '#FF6B6B',
        Organization: '#4ECDC4',
        Location: '#FFE66D',
        Concept: '#6A0572',
        Event: '#F7B801',
        // Add more types as needed
      };
      
      return colors[type] || '#999';
    };
    
    // Drag functions for d3
    const drag = (simulation) => {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    };
    
    // Functions for zoom control
    const zoomIn = () => {
      svg.value.transition().call(
        zoom.value.scaleBy, 1.5
      );
    };
    
    const zoomOut = () => {
      svg.value.transition().call(
        zoom.value.scaleBy, 0.75
      );
    };
    
    const resetZoom = () => {
      svg.value.transition().call(
        zoom.value.transform, d3.zoomIdentity
      );
    };
    
    // Function to update layout
    const updateLayout = () => {
      if (!simulation.value) return;
      
      simulation.value.stop();
      
      if (selectedLayout.value === 'force') {
        simulation.value
          .force('link', d3.forceLink(graphData.value.links).id(d => d.id).distance(100))
          .force('charge', d3.forceManyBody().strength(-200))
          .force('center', d3.forceCenter(
            graphContainer.value.clientWidth / 2, 
            graphContainer.value.clientHeight / 2
          ));
      } else if (selectedLayout.value === 'circular') {
        simulation.value
          .force('link', d3.forceLink(graphData.value.links).id(d => d.id).distance(50))
          .force('charge', d3.forceManyBody().strength(-50))
          .force('center', d3.forceCenter(
            graphContainer.value.clientWidth / 2, 
            graphContainer.value.clientHeight / 2
          ))
          .force('radial', d3.forceRadial(
            graphContainer.value.clientWidth / 4,
            graphContainer.value.clientWidth / 2,
            graphContainer.value.clientHeight / 2
          ));
      } else if (selectedLayout.value === 'hierarchical') {
        // Apply hierarchical layout
        const stratify = d3.stratify()
          .id(d => d.id)
          .parentId(d => {
            const parentLink = graphData.value.links.find(link => link.target === d.id);
            return parentLink ? parentLink.source : null;
          });
        
        try {
          const root = stratify(graphData.value.nodes);
          
          const treeLayout = d3.tree()
            .size([
              graphContainer.value.clientWidth - 100, 
              graphContainer.value.clientHeight - 100
            ]);
          
          const nodes = treeLayout(root);
          
          nodes.each(node => {
            const originalNode = graphData.value.nodes.find(n => n.id === node.id);
            if (originalNode) {
              originalNode.x = node.x + 50;
              originalNode.y = node.y + 50;
            }
          });
        } catch (error) {
          console.error('Error applying hierarchical layout:', error);
          // Fallback to force layout
          simulation.value
            .force('link', d3.forceLink(graphData.value.links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(
              graphContainer.value.clientWidth / 2, 
              graphContainer.value.clientHeight / 2
            ));
        }
      }
      
      simulation.value.alpha(1).restart();
    };
    
    // Function to close the info panel
    const closeInfoPanel = () => {
      selectedNode.value = null;
    };
    
    // Lifecycle hooks
    Vue.onMounted(() => {
      // Initialize container dimensions
      if (graphContainer.value) {
        graphContainer.value.style.height = '600px';
      }
    });
    
    Vue.onBeforeUnmount(() => {
      // Clean up D3 simulation
      if (simulation.value) {
        simulation.value.stop();
      }
    });
    
    return {
      fileInput,
      selectedFile,
      isProcessing,
      status,
      processingProgress,
      graphContainer,
      graphData,
      selectedNode,
      selectedLayout,
      handleFileUpload,
      processPdf,
      zoomIn,
      zoomOut,
      resetZoom,
      updateLayout,
      closeInfoPanel
    };
  }
};