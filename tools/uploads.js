// ./tools/uploads.js (refactored with conditional renaming)
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Ensure the DATA directory exists
async function ensureDataDirectory() {
  const dataDir = process.env.DATA;
  if (!dataDir) {
    throw new Error('DATA environment variable is not set');
  }
  await fs.mkdir(dataDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureDataDirectory();
      cb(null, process.env.DATA);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Parse UUIDs from request body if provided
    let uuids = [];
    try {
      if (req.body.uuids) {
        uuids = JSON.parse(req.body.uuids) || [];
      }
    } catch (parseErr) {
      console.warn('Invalid UUIDs format, falling back to original name:', parseErr.message);
    }

    const index = req.files ? req.files.findIndex(f => f.fieldname === file.fieldname) : -1;
    if (index >= 0 && uuids[index]) {
      // Use UUID as filename if provided and matches the file index
      cb(null, uuids[index]);
    } else {
      // Fallback to original name with timestamp prefix to avoid overwrites
      const timestamp = Date.now();
      const originalName = file.originalname;
      cb(null, `${timestamp}-${originalName}`);
    }
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