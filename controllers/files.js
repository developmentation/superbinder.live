// ./controllers/files.js
const path = require('path');
const fs = require('fs').promises;
const { upload } = require('../tools/uploads.js');
const { ocrUpload } = require('../tools/ocrUploads.js'); // New import
const { GoogleGenerativeAI } = require("@google/generative-ai");

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
  try {
    ocrUpload.array('files', 3000)(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ message: 'File upload failed', error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
      const maxFileCount = 3000;

      if (req.files.length > maxFileCount) {
        return res.status(400).json({ message: `Too many files uploaded (${req.files.length}). Maximum allowed is ${maxFileCount}.` });
      }

      // Process files with provided MIME types from memory
      const fileData = req.files.map(file => {
        const uuid = file.originalname; // Assuming filename is UUID
        const mimeType = req.body[`mimeType_${uuid}`];
        if (!supportedMimeTypes.includes(mimeType)) {
          console.warn(`Unsupported MIME type for file ${uuid}: ${mimeType}`);
          return null;
        }

        const base64Image = file.buffer.toString('base64');
        return { base64Image, mimeType };
      }).filter(data => data !== null);

      if (fileData.length === 0) {
        return res.status(400).json({ message: 'No valid files uploaded. Supported MIME types: image/png, image/jpeg, image/webp' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: 'GEMINI_API_KEY environment variable is not set' });
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const customPrompt = `
        Interpret the following image(s) and extract out and describe their key features in a JSON schema, as follows:
        {
          "text": "string", // The extracted text from the image
          "features": [
            {
              "type": "string", // e.g., "text", "table", "image", "heading"
              "description": "string", // Brief description of the feature
              "content": "string" // The content of the feature (e.g., text, table data)
            }
          ]
        }
        Please process each image and return an array of results in this exact JSON format, one entry per image.
      `;

      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              ...fileData.map(data => ({
                inlineData: {
                  data: data.base64Image,
                  mimeType: data.mimeType,
                },
              })),
              {
                text: customPrompt,
              },
            ],
          },
        ],
      };

      const response = await model.generateContent(request);
      const fullTextResponse = response.response.candidates[0].content.parts[0].text;

      // let ocrResults;
      // try {
      //   ocrResults = JSON.parse(fullTextResponse);
      //   if (!Array.isArray(ocrResults)) {
      //     throw new Error('Expected an array of OCR results');
      //   }
      // } catch (parseErr) {
      //   console.error('Failed to parse Gemini response as JSON:', parseErr.message);
      //   return res.status(500).json({
      //     message: 'OCR completed but response parsing failed',
      //     rawResponse: fullTextResponse,
      //     error: parseErr.message,
      //   });
      // }

      // if (ocrResults.length !== fileData.length) {
      //   console.warn(`Mismatch between OCR results (${ocrResults.length}) and valid files (${fileData.length})`);
      // }

      res.status(200).json({
        message: 'OCR completed successfully',
        text: fullTextResponse,
      });
    });
  } catch (error) {
    console.error('Error performing OCR:', error);
    res.status(500).json({ message: 'Failed to perform OCR', error: error.message });
  }
};

module.exports = filesController;