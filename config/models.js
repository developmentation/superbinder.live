// ./models.js
const mongoose = require('mongoose');

// EntitySet Schema (used by all entity types)
const entitySetSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true },
  channel: { type: String, required: true, index: true },
  userUuid: { type: String, required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  timestamp: { type: Number, required: true },
  serverTimestamp: { type: Number, required: true, index: true },
}, { timestamps: true });

// LibrarySet Schema
const librarySetSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true, index: true },
//   channel: { type: String, required: true, index: true },
  data: {
    name: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    votes: { type: Number, default: 0 },
    copies: { type: Number, default: 0 },
  },
  timestamp: { type: Number, required: true, index: true },
}, { timestamps: true });

// Register models
const entityModels = {
  agents: mongoose.model('agentsSet', entitySetSchema, 'agentsSet'),
  chat: mongoose.model('chatsSet', entitySetSchema, 'chatsSet'),
  documents: mongoose.model('documentsSet', entitySetSchema, 'documentsSet'),
  goals: mongoose.model('goalsSet', entitySetSchema, 'goalsSet'),
  questions: mongoose.model('questionsSet', entitySetSchema, 'questionsSet'),
  answers: mongoose.model('answersSet', entitySetSchema, 'answersSet'),
  artifacts: mongoose.model('artifactsSet', entitySetSchema, 'artifactsSet'),
  transcripts: mongoose.model('transcriptsSet', entitySetSchema, 'transcriptsSet'),
  llm: mongoose.model('llmsSet', entitySetSchema, 'llmsSet'), // Fixed typo 'llurnal' to 'llm'
  collab: mongoose.model('collabsSet', entitySetSchema, 'collabsSet'),
  breakout: mongoose.model('breakoutsSet', entitySetSchema, 'breakoutsSet'),
  sections: mongoose.model('sectionsSet', entitySetSchema, 'sectionsSet'),
  channels: mongoose.model('channelsSet', entitySetSchema, 'channelsSet'),
  prompts: mongoose.model('promptsSet', entitySetSchema, 'promptsSet'),
};

const LibrarySet = mongoose.model('librarySet', librarySetSchema, 'librarySet');

// Export models
module.exports = {
  entityModels,
  LibrarySet,
};