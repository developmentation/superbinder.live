// ./controllers/files.js (updated to handle renaming to UUIDs)
const path = require('path');
const fs = require('fs').promises;
const { upload } = require('../tools/uploads.js');

// Controller object
const filesController = {};

/**
 * POST /api/files
 * Handles multiple file uploads, renaming them to UUIDs and saving to process.env.DATA.
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

      // Validate and set DATA directory
      const dataDir = process.env.DATA || path.resolve(__dirname, '../files');
      if (!dataDir) {
        return res.status(500).json({ message: 'DATA environment variable is not set and default path resolution failed' });
      }
      console.log('Using data directory:', dataDir);

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

      // Log the files and UUIDs for debugging
      console.log('Uploaded files (before renaming):', req.files.map(file => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
      })));
      console.log('Provided UUIDs:', uuids);

      // Rename files to UUIDs if provided
      const results = await Promise.all(req.files.map(async (file, index) => {
        const originalPath = path.join(dataDir, file.filename);
        let newFilename = file.originalname; // Default to original name if no UUID
        let newPath = originalPath;
        let renamedCorrectly = true;

        if (uuids.length > 0 && uuids[index]) {
          newFilename = uuids[index];
          newPath = path.join(dataDir, newFilename);
          try {
            await fs.rename(originalPath, newPath);
            console.log(`Renamed ${file.originalname} to ${newFilename}`);
          } catch (renameErr) {
            console.error(`Failed to rename ${file.originalname} to ${newFilename}:`, renameErr.message);
            renamedCorrectly = false;
            newPath = originalPath; // Keep original path if rename fails
          }
        }

        let fileExists = false;
        try {
          await fs.access(newPath);
          fileExists = true;
        } catch (accessErr) {
          console.warn(`File not found at ${newPath}:`, accessErr.message);
          fileExists = false;
        }

        return {
          uuid: uuids[index] || null,
          saved: fileExists,
          originalName: file.originalname,
          filename: newFilename,
          renamedCorrectly: renamedCorrectly,
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

    // Validate and set DATA directory
    const dataDir = process.env.DATA || path.resolve(__dirname, '../files');
    if (!dataDir) {
      return res.status(500).json({ message: 'DATA environment variable is not set and default path resolution failed' });
    }
    console.log('Using data directory for retrieval:', dataDir);

    // Retrieve files
    const files = [];
    for (const uuid of uuids) {
      const filePath = path.join(dataDir, uuid);
      try {
        // Read file binary
        const fileBuffer = await fs.readFile(filePath);
        files.push({
          uuid,
          filename: uuid,
          data: fileBuffer.toString('base64'),
          mimeType: 'application/octet-stream',
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