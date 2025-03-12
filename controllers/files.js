// ./controllers/files.js (updated to fix fs.existsSync error)
const path = require('path');
const fs = require('fs').promises;
const { upload } = require('../tools/uploads.js');

// Controller object
const filesController = {};

/**
 * POST /api/files
 * Handles multiple file uploads, saving them to process.env.DATA with UUID filenames if provided.
 * Expects req.body.uuids to be a JSON string array of UUIDs matching the order of files.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
filesController.addFiles = async (req, res) => {
  try {
    // Use Multer middleware to handle file uploads
    upload.array('files', 100)(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ message: 'File upload failed', error: err.message });
      }

      // Ensure files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      // Parse UUIDs from request body
      let uuids;
      try {
        uuids = req.body.uuids ? JSON.parse(req.body.uuids) : [];
      } catch (parseErr) {
        return res.status(400).json({ message: 'Invalid UUIDs format', error: parseErr.message });
      }

      // Validate UUIDs match the number of files if provided
      if (uuids.length > 0 && uuids.length !== req.files.length) {
        return res.status(400).json({ message: `Mismatch between UUIDs (${uuids.length}) and files (${req.files.length})` });
      }

      // Verify saved filenames match UUIDs if provided
      const results = await Promise.all(req.files.map(async (file, index) => {
        const expectedFilename = uuids[index] || file.filename; // Use UUID or fallback filename
        const savedPath = path.join(process.env.DATA, file.filename);
        let fileExists = false;
        try {
          await fs.access(savedPath); // Check if file exists asynchronously
          fileExists = true;
        } catch (accessErr) {
          console.warn(`File not found at ${savedPath}:`, accessErr.message);
          fileExists = false;
        }
        const isRenamedCorrectly = uuids[index] ? file.filename === uuids[index] : true;
        return {
          uuid: uuids[index] || null,
          saved: fileExists,
          originalName: file.originalname,
          filename: file.filename,
          renamedCorrectly: isRenamedCorrectly,
        };
      }));

      // Check for renaming failures
      const renamingFailures = results.filter(result => result.uuid && !result.renamedCorrectly);
      if (renamingFailures.length > 0) {
        console.warn('Renaming failures detected:', renamingFailures);
        return res.status(500).json({
          message: 'Files uploaded but renaming failed for some UUIDs',
          files: results,
          failures: renamingFailures,
        });
      }

      res.status(200).json({
        message: 'Files uploaded successfully',
        files: results,
      });
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ message: 'Failed to upload files', error: error.message });
  }
};

/**
 * GET /api/files
 * Retrieves files from process.env.DATA based on an array of UUIDs.
 * Expects query parameter ?uuids=["uuid1","uuid2",...].
 * Returns file binaries, filenames, and MIME types.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
filesController.retrieveFiles = async (req, res) => {
  try {
    // Parse UUIDs from query parameter
    let uuids;
    try {
      uuids = req.query.uuids ? JSON.parse(req.query.uuids) : [];
    } catch (parseErr) {
      return res.status(400).json({ message: 'Invalid UUIDs format in query', error: parseErr.message });
    }

    if (!Array.isArray(uuids) || uuids.length === 0) {
      return res.status(400).json({ message: 'UUIDs must be a non-empty array' });
    }

    // Ensure DATA directory exists
    const dataDir = process.env.DATA;
    if (!dataDir) {
      return res.status(500).json({ message: 'DATA environment variable is not set' });
    }

    // Retrieve files
    const files = [];
    for (const uuid of uuids) {
      const filePath = path.join(dataDir, uuid);
      try {
        // Read file binary
        const fileBuffer = await fs.readFile(filePath);
        // We don’t have the original extension/MIME type stored; assume binary response
        files.push({
          uuid,
          filename: uuid, // No extension stored
          data: fileBuffer.toString('base64'), // Encode as base64 for JSON response
          mimeType: 'application/octet-stream', // Default MIME type (unknown)
        });
      } catch (fileErr) {
        console.warn(`File not found for UUID ${uuid}:`, fileErr.message);
        files.push({
          uuid,
          error: 'File not found',
        });
      }
    }

    res.status(200).json({
      message: 'Files retrieved successfully',
      files,
    });
  } catch (error) {
    console.error('Error retrieving files:', error);
    res.status(500).json({ message: 'Failed to retrieve files', error: error.message });
  }
};

module.exports = filesController;