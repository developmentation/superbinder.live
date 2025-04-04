// ./controllers/files.js
const path = require('path');
const fs = require('fs').promises;
const { upload } = require('../tools/uploads.js');
const { ocrUpload } = require('../tools/ocrUploads.js');
const { GoogleGenAI } = require('@google/genai');
const { HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const filesController = {};

/**
 * POST /api/files
 */
filesController.addFiles = async (req, res) => {
  try {
    upload.array('files', 100)(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ message: 'File upload failed', error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const dataDir = process.env.DATA || path.resolve(__dirname, '../files');
      if (!dataDir) {
        return res.status(500).json({ message: 'DATA environment variable is not set and default path resolution failed' });
      }
      console.log('Using data directory:', dataDir);

      let uuids;
      try {
        uuids = req.body.uuids ? JSON.parse(req.body.uuids) : [];
      } catch (parseErr) {
        return res.status(400).json({ message: 'Invalid UUIDs format', error: parseErr.message });
      }

      if (uuids.length > 0 && uuids.length !== req.files.length) {
        return res.status(400).json({ message: `Mismatch between UUIDs (${uuids.length}) and files (${req.files.length})` });
      }

      console.log('Uploaded files (before renaming):', req.files.map(file => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
      })));
      console.log('Provided UUIDs:', uuids);

      const results = await Promise.all(req.files.map(async (file, index) => {
        const originalPath = path.join(dataDir, file.filename);
        let newFilename = file.originalname;
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
            newPath = originalPath;
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
 */
filesController.retrieveFiles = async (req, res) => {
  try {
    let uuids;
    try {
      uuids = req.query.uuids ? JSON.parse(req.query.uuids) : [];
    } catch (parseErr) {
      return res.status(400).json({ message: 'Invalid UUIDs format in query', error: parseErr.message });
    }

    if (!Array.isArray(uuids) || uuids.length === 0) {
      return res.status(400).json({ message: 'UUIDs must be a non-empty array' });
    }

    const dataDir = process.env.DATA || path.resolve(__dirname, '../files');
    if (!dataDir) {
      return res.status(500).json({ message: 'DATA environment variable is not set and default path resolution failed' });
    }
    console.log('Using data directory for retrieval:', dataDir);

    const files = [];
    for (const uuid of uuids) {
      const filePath = path.join(dataDir, uuid);
      try {
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

/**
 * POST /api/files/ocr
 */
filesController.ocrFile = async (req, res) => {

  
 const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];


  try {
    ocrUpload.array('files', 3000)(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ message: 'File upload failed', error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
      const maxFileCount = 3000;

      if (req.files.length > maxFileCount) {
        return res.status(400).json({ message: `Too many files uploaded (${req.files.length}). Maximum allowed is ${maxFileCount}.` });
      }

      const customPrompt = req.body.prompt;
      if (!customPrompt) {
        return res.status(400).json({ message: 'OCR prompt is required' });
      }

      // Match files with their metadata based on order
      const fileData = req.files.map((file, index) => {
        const uuidKeys = Object.keys(req.body).filter(key => key.startsWith('mimeType_'));
        if (index >= uuidKeys.length) {
          console.warn(`No matching metadata for file at index ${index}`);
          return null;
        }
        const uuid = uuidKeys[index].replace('mimeType_', '');
        const mimeType = req.body[`mimeType_${uuid}`];
        const page = parseInt(req.body[`page_${uuid}`], 10) || 0;

        if (!supportedMimeTypes.includes(mimeType)) {
          console.warn(`Unsupported MIME type for UUID ${uuid}: ${mimeType}`);
          return null;
        }

        return { uuid, buffer: file.buffer, mimeType, page };
      }).filter(data => data !== null);

      if (fileData.length === 0) {
        return res.status(400).json({ message: 'No valid files uploaded. Supported MIME types: image/png, image/jpeg, image/webp, application/pdf' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: 'GEMINI_API_KEY environment variable is not set' });
      }

      const ai = new GoogleGenAI({ apiKey });

      const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            return await fn();
          } catch (error) {
            if (error.status === 429 && attempt < retries) {
              const waitTime = delay * Math.pow(2, attempt);
              console.warn(`429 Too Many Requests detected for attempt ${attempt + 1}/${retries + 1}. Retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            throw error;
          }
        }
      };

      const ocrResults = await Promise.all(fileData.map(async ({ uuid, buffer, mimeType, page }) => {
        const base64Image = buffer.toString('base64');
        console.log(`Processing OCR for UUID ${uuid}: mimeType=${mimeType}, page=${page}, data length=${buffer.length}`);

        const request = {
          model: 'gemini-2.0-flash', // Reverted to original model
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: base64Image,
                    mimeType: mimeType === 'application/pdf' ? 'image/png' : mimeType, // Original behavior
                  },
                },
                { text: customPrompt },
              ],
            },
          ],
          safety_settings:safetySettings,
        };

        try {
          const response = await retryWithBackoff(async () => {
            const result = await ai.models.generateContent(request);
            if (!result?.text) {
              throw new Error('Invalid response format from GoogleGenAI');
            }
            return result;
          });
          const text = response.text;
          console.log(`OCR result for UUID ${uuid}:`, text);
          return { uuid, text, page };
        } catch (error) {
          console.error(`OCR failed for UUID ${uuid}:`, error.message);
          return { uuid, text: null, page, error: error.message };
        }
      }));

      const successfulResults = ocrResults.filter(result => !result.error);
      const failedResults = ocrResults.filter(result => result.error);

      const responseBody = {
        message: failedResults.length > 0
          ? 'OCR completed with some failures'
          : 'OCR completed successfully',
        uuids: ocrResults.map(result => result.uuid),
        text: ocrResults.map(result => result.text),
        pages: ocrResults.map(result => result.page),
      };

      if (failedResults.length > 0) {
        responseBody.errors = failedResults.map(result => ({
          uuid: result.uuid,
          error: result.error,
        }));
        res.status(207);
      } else {
        res.status(200);
      }

      res.json(responseBody);
    });
  } catch (error) {
    console.error('Unexpected error in OCR processing:', error);
    res.status(500).json({ message: 'Failed to perform OCR', error: error.message });
  }
};

module.exports = filesController;