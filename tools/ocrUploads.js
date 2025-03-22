// ./tools/ocrUploads.js
const multer = require('multer');

// In-memory storage configuration for OCR uploads
const memoryStorage = multer.memoryStorage();

// Multer configuration for in-memory uploads
const ocrUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 7 * 1024 * 1024, // 7MB limit per file (matches Gemini's per-file limit)
    files: 3000, // Max 3000 files per request (matches Gemini's limit)
  },
  fileFilter: (req, file, cb) => {
    // Optional: Validate file types if needed, but we'll rely on frontend/backend filtering
    cb(null, true);
  },
});

module.exports = {
  ocrUpload,
};