// ./controllers/library.js
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { handleImageGeneration } = require('../config/handleAiImages');
const { entityModels, LibrarySet } = require('../config/models');

// A simple base64-encoded placeholder image (gray square)
const FALLBACK_IMAGE_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQgJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFREBAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFREBAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFREBAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFREBAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFREBAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFREBAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAB//2Q==';

const libraryController = {};

/**
 * POST /api/library
 * Publish a binder as a library artifact
 */
libraryController.publishBinder = async (req, res) => {
  try {
    const { channelName, name, description } = req.body;
    if (!channelName || !name || !description) {
      return res.status(400).json({ message: 'Missing required fields: channelName, name, or description' });
    }

    // Collect all documents from the binder's collections
    const binderData = {};
    for (const [entityType, model] of Object.entries(entityModels)) {
      binderData[entityType] = await model
        .find({ channel: channelName })
        .lean()
        .then(docs => docs.map(doc => {
          const { _id, __v, ...rest } = doc; // Remove MongoDB-specific fields
          rest.channel = null; // Replace channel name with null
          return rest;
        }));
    }

    // Generate UUID for the artifact file
    const uuid = uuidv4();
    const dataDir = process.env.DATA || path.resolve(__dirname, '../files');
    const filePath = path.join(dataDir, `${uuid}.json`);

    // Save binder data as JSON file
    await fs.writeFile(filePath, JSON.stringify(binderData, null, 2));
    console.log(`Saved binder artifact to ${filePath}`);

    // Generate thumbnail image
    const imagePrompt = `Generate a nice graphical scene, fun, dynamic, and family friendly scene (ideally with people, an office, a landscape, or buildings, etc.), taking inspiration from this artifact titled "${name}" with the description "${description}". Use an aspect ratio of 3:1 always`;
    let imageBase64 = null;

    try {
      const imageResponse = await new Promise((resolve, reject) => {
        handleImageGeneration(
          {
            model: { provider: 'gemini', model: 'gemini-2.0-flash-exp-image-generation' },
            uuid,
            session: channelName,
            userPrompt:  imagePrompt,
            messageHistory: [],
          },
          (uuid, session, type, message) => {
            console.log(`handleImageGeneration callback: type=${type}, message=${message}`);
            if (type === 'image') resolve(message); // Base64 image
            else if (type === 'ERROR') {
              console.error('Image generation failed:', message);
              reject(new Error(message));
            }
          }
        );
      });

      if (imageResponse) {
        imageBase64 = imageResponse;
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const jpgBuffer = await sharp(imageBuffer)
          .resize({ width: 480, withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
        imageBase64 = `data:image/jpeg;base64,${jpgBuffer.toString('base64')}`;
      } else {
        console.warn('No image data returned from handleImageGeneration');
        imageBase64 = FALLBACK_IMAGE_BASE64; // Use fallback if no image data
      }
    } catch (error) {
      console.error('Error during image generation:', error.message);
      imageBase64 = FALLBACK_IMAGE_BASE64; // Use fallback on error
    }

    // Save to librarySet collection with channel set to null
    const libraryDoc = new LibrarySet({
      uuid,
      channel: null, // Set channel to null
      data: {
        name,
        description,
        image: imageBase64,
        votes: 0,
        copies: 0,
      },
      timestamp: Date.now(),
    });
    await libraryDoc.save();

    res.status(200).json({ message: 'Binder published successfully', uuid });
  } catch (error) {
    console.error('Error publishing binder:', error);
    res.status(500).json({ message: 'Failed to publish binder', error: error.message });
  }
};

/**
 * GET /api/library
 * Retrieve all library artifacts with votes > -5
 */
libraryController.getLibrary = async (req, res) => {
  try {
    const artifacts = await LibrarySet
      .find({ 'data.votes': { $gt: -5 } })
    //   .sort({ $expr: { $add: ['$data.votes', '$data.copies'] } }) // Sort by votes + copies descending
      .lean();

    const response = artifacts.map(artifact => ({
      uuid: artifact.uuid,
      data: artifact.data,
    }));

    res.status(200).json({ message: 'Library retrieved', artifacts: response });
  } catch (error) {
    console.error('Error retrieving library:', error);
    res.status(500).json({ message: 'Failed to retrieve library', error: error.message });
  }
};

/**
 * POST /api/library/vote
 * Vote on a library artifact
 */
libraryController.voteArtifact = async (req, res) => {
  try {
    const { uuid, vote } = req.body;
    if (!uuid || !['up', 'down'].includes(vote)) {
      return res.status(400).json({ message: 'Missing or invalid uuid or vote (up/down)' });
    }

    const artifact = await LibrarySet.findOne({ uuid });
    if (!artifact) {
      return res.status(404).json({ message: 'Library artifact not found' });
    }

    artifact.data.votes += vote === 'up' ? 1 : -1;
    await artifact.save();

    res.status(200).json({ message: 'Vote recorded', uuid, votes: artifact.data.votes });
  } catch (error) {
    console.error('Error voting on artifact:', error);
    res.status(500).json({ message: 'Failed to vote on artifact', error: error.message });
  }
};

/**
 * POST /api/library/deploy
 * Deploy a library artifact with a new channel name
 */
libraryController.deployArtifact = async (req, res) => {
    try {
      const { uuid, channelName } = req.body;
      if (!uuid || !channelName) {
        return res.status(400).json({ message: 'Missing uuid or channelName' });
      }
  
      // Load artifact file
      const dataDir = process.env.DATA || path.resolve(__dirname, '../files');
      const filePath = path.join(dataDir, `${uuid}.json`);
      let binderData;
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        binderData = JSON.parse(fileContent);
      } catch (fileError) {
        return res.status(404).json({ message: 'Artifact file not found', error: fileError.message });
      }
  
      // Generate new UUIDs for documents and copy their associated files
      const documentUuidMap = new Map(); // Map old UUID to new UUID
      if (binderData.documents && Array.isArray(binderData.documents)) {
        for (const doc of binderData.documents) {
          const oldUuid = doc.id;
          const newUuid = uuidv4();
          documentUuidMap.set(oldUuid, newUuid);
  
          // Update the document's UUID
          doc.id = newUuid;
  
          // Update any references to the old UUID in the document's data
          if (doc.data) {
            if (doc.data.uuid === oldUuid) doc.data.uuid = newUuid;
            if (doc.data.id === oldUuid) doc.data.id = newUuid;
            if (doc.data.filename === oldUuid) doc.data.filename = newUuid;
          }
  
          // Copy the associated file from old UUID to new UUID
          const oldFilePath = path.join(dataDir, oldUuid);
          const newFilePath = path.join(dataDir, newUuid);
          try {
            await fs.copyFile(oldFilePath, newFilePath);
            console.log(`Copied file from ${oldFilePath} to ${newFilePath}`);
          } catch (fileError) {
            if (fileError.code === 'ENOENT') {
              console.warn(`File not found for document UUID ${oldUuid} at ${oldFilePath}. Skipping copy.`);
            } else {
              console.error(`Error copying file for document UUID ${oldUuid} to ${newUuid}:`, fileError.message);
            }
          }
        }
      }
  
      // Update references to document UUIDs in other entities
      for (const entityType of Object.keys(binderData)) {
        if (entityType === 'documents') continue; // Already processed documents
        if (Array.isArray(binderData[entityType])) {
          for (const entity of binderData[entityType]) {
            if (entity.data) {
              // Recursively search for and replace old document UUIDs in the data object
              const replaceUuids = (obj) => {
                if (typeof obj !== 'object' || obj === null) return;
                for (const key of Object.keys(obj)) {
                  if (typeof obj[key] === 'string' && documentUuidMap.has(obj[key])) {
                    obj[key] = documentUuidMap.get(obj[key]);
                  } else if (typeof obj[key] === 'object') {
                    replaceUuids(obj[key]);
                  }
                }
              };
              replaceUuids(entity.data);
            }
          }
        }
      }
  
      // Update channel name in all documents
      for (const entityType of Object.keys(binderData)) {
        binderData[entityType].forEach(doc => {
          doc.channel = channelName;
        });
  
        // Insert into respective collections (allow duplicates for merging)
        if (binderData[entityType].length > 0) {
          await entityModels[entityType].insertMany(binderData[entityType]);
        }
      }
  
      // Increment copies count
      const artifact = await LibrarySet.findOne({ uuid });
      if (!artifact) {
        return res.status(404).json({ message: 'Library artifact not found in database' });
      }
      artifact.data.copies += 1;
      await artifact.save();
  
      res.status(200).json({ message: 'Binder deployed', uuid, channelName });
    } catch (error) {
      console.error('Error deploying artifact:', error);
      res.status(500).json({ message: 'Failed to deploy artifact', error: error.message });
    }
  };
module.exports = libraryController;