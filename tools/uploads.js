// ./tools/uploads.js (simplified to only upload files)
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Ensure the DATA directory exists
async function ensureDataDirectory() {
  const dataDir = process.env.DATA || path.resolve(__dirname, '../files');
  if (!dataDir) {
    throw new Error('DATA environment variable is not set and default path resolution failed');
  }
  await fs.mkdir(dataDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureDataDirectory();
      cb(null, process.env.DATA || path.resolve(__dirname, '../files'));
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Keep the original filename without any renaming
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize to avoid filesystem issues
    console.log(`Uploading file: ${sanitizedOriginalName}`);
    cb(null, sanitizedOriginalName);
  },
});

// Multer configuration with limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1000 * 1024 * 1024, // 100MB limit per file
    files: 100, // Max 100 files per request
  },
  fileFilter: (req, file, cb) => {
    // Optional: Add file type validation if needed
    cb(null, true);
  },
});

module.exports = {
  upload,
};