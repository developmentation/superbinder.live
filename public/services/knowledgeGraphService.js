// src/services/knowledgeGraphService.js

import axios from 'axios';
import neo4j from 'neo4j-driver';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Service for creating and managing knowledge graphs from PDF documents
 */
export const knowledgeGraphService = {
  /**
   * Initialize the Neo4j driver
   * @returns {object} Neo4j driver instance
   */
  initDriver() {
    return neo4j.driver(
      process.env.VUE_APP_NEO4J_URI || 'neo4j://localhost:7687',
      neo4j.auth.basic(
        process.env.VUE_APP_NEO4J_USER || 'neo4j',
        process.env.VUE_APP_NEO4J_PASSWORD || 'password'
      )
    );
  },

  /**
   * Extract text content from a PDF file
   * @param {File} file - PDF file to process
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromPdf(file, progressCallback) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const typedArray = new Uint8Array(event.target.result);
          
          // Set worker path to pdf.worker.js
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.js';
          
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          progressCallback?.('extracting', `Extracting text from ${pdf.numPages} pages...`);
          
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const progress = (i / pdf.numPages) * 30; // First 30% of progress
            progressCallback?.('progress', progress);
            
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
          }
          
          resolve(fullText);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Extract entities and relationships using OpenAI
   * @param {string} text - Text content to analyze
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<object>} Extracted entities and relationships
   */
  async extractEntitiesAndRelationships(text, progressCallback) {
    try {
      progressCallback?.('extracting', 'Analyzing text with OpenAI...');
      progressCallback?.('progress', 40); // 40% progress

      // Use API key from environment variables
      const apiKey = process.env.VUE_APP_OPENAI_API_KEY;
      
      // You can also use the existing openai client if already set up in your project
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4', // or another appropriate model
          messages: [
            {
              role: 'system',
              content: `You are a knowledge graph assistant. Extract entities and relationships from the following text.
              Format your output as a JSON object with two arrays:
              1. "entities": Each entity should have "id", "label", "type", and optional "properties".
              2. "relationships": Each relationship should have "source" (entity id), "target" (entity id), "type", and optional "properties".
              Focus on key concepts, people, organizations, locations, and important ideas.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      progressCallback?.('progress', 70); // 70% progress
      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  },

  /**
   * Store entities and relationships in Neo4j
   * @param {object} data - Data containing entities and relationships
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<object>} The stored data
   */
  async storeInNeo4j(data, progressCallback) {
    const driver = this.initDriver();
    const session = driver.session();
    
    try {
      progressCallback?.('storing', 'Storing data in Neo4j...');
      progressCallback?.('progress', 80); // 80% progress

      // Clear existing data (optional)
      await session.run('MATCH (n) DETACH DELETE n');

      // Create entities
      for (const entity of data.entities) {
        const propertiesString = entity.properties 
          ? `, ${Object.entries(entity.properties).map(([key, value]) => 
              `${key}: $${key}`).join(', ')}`
          : '';
        
        await session.run(
          `CREATE (n:${entity.type} {id: $id, label: $label${propertiesString}})`,
          {
            id: entity.id,
            label: entity.label,
            ...entity.properties
          }
        );
      }

      // Create relationships
      for (const rel of data.relationships) {
        const propertiesString = rel.properties 
          ? `, ${Object.entries(rel.properties).map(([key, value]) => 
              `${key}: $${key}`).join(', ')}`
          : '';
        
        await session.run(
          `MATCH (a), (b) 
           WHERE a.id = $sourceId AND b.id = $targetId
           CREATE (a)-[r:${rel.type} {${propertiesString}}]->(b)`,
          {
            sourceId: rel.source,
            targetId: rel.target,
            ...rel.properties
          }
        );
      }

      progressCallback?.('progress', 90); // 90% progress
      return data;
    } finally {
      await session.close();
      await driver.close();
    }
  },

  /**
   * Retrieve graph data from Neo4j
   * @returns {Promise<object>} Nodes and links for visualization
   */
  async retrieveFromNeo4j() {
    const driver = this.initDriver();
    const session = driver.session();
    
    try {
      // Get nodes
      const nodesResult = await session.run(
        `MATCH (n) 
         RETURN n.id AS id, n.label AS label, labels(n)[0] AS type, 
                properties(n) AS properties`
      );
      
      const nodes = nodesResult.records.map(record => {
        const properties = record.get('properties');
        delete properties.id;
        delete properties.label;
        
        return {
          id: record.get('id'),
          label: record.get('label'),
          type: record.get('type'),
          properties: properties
        };
      });

      // Get relationships
      const relsResult = await session.run(
        `MATCH (a)-[r]->(b) 
         RETURN a.id AS source, b.id AS target, type(r) AS type, 
                properties(r) AS properties`
      );
      
      const links = relsResult.records.map(record => ({
        source: record.get('source'),
        target: record.get('target'),
        type: record.get('type'),
        properties: record.get('properties')
      }));

      return { nodes, links };
    } finally {
      await session.close();
      await driver.close();
    }
  },

  /**
   * Process a PDF file to create a knowledge graph
   * @param {File} file - PDF file to process
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<object>} The graph data (nodes and links)
   */
  async processPdf(file, progressCallback) {
    try {
      progressCallback?.('status', 'Starting to process PDF...');
      progressCallback?.('progress', 0);

      // Step 1: Extract text from PDF
      const text = await this.extractTextFromPdf(file, progressCallback);
      
      // Step 2: Extract entities and relationships using OpenAI
      const extractedData = await this.extractEntitiesAndRelationships(text, progressCallback);
      
      // Step 3: Store in Neo4j
      await this.storeInNeo4j(extractedData, progressCallback);
      
      // Step 4: Retrieve from Neo4j for visualization
      const graphData = await this.retrieveFromNeo4j();
      
      progressCallback?.('status', 'PDF processed successfully!');
      progressCallback?.('progress', 100);
      
      return graphData;
    } catch (error) {
      console.error('Error processing PDF:', error);
      progressCallback?.('error', error.message);
      throw error;
    }
  }
};

export default knowledgeGraphService;