// ./composables/useFiles.js
const files = Vue.ref({});

const defaultOcrPrompt = `
  Interpret the following image(s) and extract out and describe their key features in a JSON schema, as follows:
  {
    "text": "string",
    "interpretation": "string",
    "otherContent": "string",
    "otherData": "array",
    "features": [
      {
        "type": "string",
        "description": "string"
      }
    ]
  }
  Please process each image and return an array of results in this exact JSON format, one entry per image.
`;

const ocrPrompt = Vue.ref(defaultOcrPrompt);

export function useFiles() {
  async function uploadFiles(fileList, uuids = fileList.map(() => uuidv4())) {
    const formData = new FormData();
    formData.append('uuids', JSON.stringify(uuids));
    fileList.forEach((file) => {
      formData.append('files', file);
    });

    console.log("uploading fileList", fileList);

    try {
      const response = await axios.post('/api/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { files: results } = response.data;

      const failures = results.filter(result => result.uuid && !result.renamedCorrectly);
      if (failures.length > 0) {
        console.error('Upload failures detected:', failures);
        throw new Error('Some files failed to upload or rename correctly');
      }

      return { uuids, results };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  async function retrieveFiles(uuids) {
    try {
      const response = await axios.get(`/api/files?uuids=${JSON.stringify(uuids)}`);
      const retrievedFiles = response.data.files;
      await Promise.all(retrievedFiles.map(async (file) => {
        if (file.data && !file.error) {
          const binaryString = atob(file.data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          files.value[file.uuid] = {
            filename: file.filename,
            data: bytes,
            mimeType: file.mimeType,
          };
        }
      }));
      return retrievedFiles;
    } catch (error) {
      console.error('Retrieval failed:', error);
      throw error;
    }
  }

  // Helper function to convert base64 to Uint8Array
  function base64ToUint8Array(base64) {
    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.error('Failed to decode base64:', e);
      return null;
    }
  }

  // Extract base64 image from PDF HTML content
  function extractImageFromPdfHtml(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const img = doc.querySelector('img');
    if (img && img.src.startsWith('data:image/')) {
      const base64Data = img.src.split(',')[1];
      const mimeType = img.src.split(';')[0].split(':')[1];
      return { data: base64ToUint8Array(base64Data), mimeType };
    }
    console.warn('No valid image found in PDF HTML:', htmlContent);
    return null;
  }

  // Process an artifact with base64 image in data.pages[0]
  async function processArtifact(doc, page) {
    const pageContent = doc.data.pages?.[0];
    if (!pageContent || typeof pageContent !== 'string') {
      console.warn(`Artifact ${doc.id} has no valid page content at pages[0]:`, pageContent);
      return null;
    }
    let base64Data = pageContent;
    if (pageContent.startsWith('data:image/')) {
      base64Data = pageContent.split(',')[1];
    }
    const data = base64ToUint8Array(base64Data);
    if (!data) return null;
    return { data, mimeType: 'image/jpeg', page: 0 }; // Artifacts are always page 0
  }

  // Process a PDF document
  async function processPdf(doc, page) {
    const pageContent = doc.data.pages?.[page];
    if (!pageContent || typeof pageContent !== 'string') {
      console.warn(`PDF ${doc.id} has no valid content at page ${page}:`, pageContent);
      return null;
    }
    if (pageContent.startsWith('data:image/')) {
      const base64Data = pageContent.split(',')[1];
      const mimeType = pageContent.split(';')[0].split(':')[1];
      const data = base64ToUint8Array(base64Data);
      if (!data) return null;
      return { ...result, page };
    }
    if (pageContent.includes('<img')) {
      const result = extractImageFromPdfHtml(pageContent);
      if (!result) return null;
      return { ...result, page };
    }
    console.warn(`PDF ${doc.id} page ${page} has unsupported content:`, pageContent);
    return null;
  }

  // Process a document image from files.value
  async function processDocumentImage(doc, page) {
    const file = files.value[doc.id];
    if (!file || !file.data) {
      console.warn(`No file data found for document ${doc.id} in files.value`);
      return null;
    }
    return { data: file.data, mimeType: doc.data.mimeType, page: 0 }; // Images are single-page
  }

  // Process a raw File object
  async function processRawFile(file, page) {
    return { data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type, page: 0 }; // Raw files are single-page
  }

  // Main OCR function
  async function ocrFiles(uuids, documentData, pages) {
    const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    const maxFileSize = 7 * 1024 * 1024; // 7MB

    console.log("To OCR", { uuids, documentData, pages });

    if (uuids.length !== documentData.length || uuids.length !== pages.length) {
      throw new Error('Mismatch between uuids, documentData, and pages arrays');
    }

    const isRawFiles = documentData.every(item => item instanceof File);
    const processedFiles = await Promise.all(uuids.map(async (uuid, index) => {
      const doc = isRawFiles ? documentData[index] : documentData.find(d => d.id === uuid);
      const page = pages[index];

      let result;
      if (isRawFiles) {
        console.log(`Processing raw file for UUID ${uuid}`);
        result = await processRawFile(doc, page);
      } else if (doc.type === 'artifact' && doc.data.type === 'image') {
        console.log(`Processing artifact for UUID ${uuid}`);
        result = await processArtifact(doc, page);
      } else if (doc.data.type === 'pdf') {
        console.log(`Processing PDF for UUID ${uuid}, page ${page}`);
        result = await processPdf(doc, page);
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(doc.data.type)) {
        console.log(`Processing document image for UUID ${uuid}`);
        if (!files.value[uuid]) await retrieveFiles([uuid]);
        result = await processDocumentImage(doc, page);
      } else {
        console.warn(`Unsupported type for UUID ${uuid}:`, doc.data.type);
        return null;
      }

      if (!result || !result.data || !supportedMimeTypes.includes(result.mimeType) || result.data.length > maxFileSize) {
        console.warn(`Invalid file for UUID ${uuid}: mimeType=${result?.mimeType}, size=${result?.data?.length}`);
        return null;
      }

      return { uuid, ...result };
    }));

    const validFiles = processedFiles.filter(item => item !== null);
    if (validFiles.length === 0) {
      throw new Error('No valid files found for OCR. Supported types: image/png, image/jpeg, image/webp, application/pdf; Max size: 7MB');
    }

    const formData = new FormData();
    formData.append('prompt', ocrPrompt.value);
    validFiles.forEach(item => {
      const blob = new Blob([item.data], { type: item.mimeType });
      formData.append('files', blob); // No filename provided
      formData.append(`mimeType_${item.uuid}`, item.mimeType);
      formData.append(`page_${item.uuid}`, item.page);
    });

    console.log('Sending OCR request with formData:');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value instanceof Blob ? `Blob(size=${value.size}, type=${value.type})` : value);
    }

    try {
      const response = await axios.post('/api/files/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { uuids: responseUuids, text, pages: responsePages } = response.data;
      if (!Array.isArray(responseUuids) || !Array.isArray(text) || !Array.isArray(responsePages)) {
        throw new Error('Invalid OCR response format');
      }

      const results = uuids.map(uuid => {
        const index = responseUuids.indexOf(uuid);
        return {
          uuid,
          text: index !== -1 ? (text[index] || '') : '',
          page: index !== -1 ? responsePages[index] : null,
        };
      });

      return {
        uuids: results.map(r => r.uuid),
        text: results.map(r => r.text),
        pages: results.map(r => r.page),
      };
    } catch (error) {
      console.error('OCR request failed:', error);
      throw error;
    }
  }

  function resetOcrPrompt() {
    console.log("resetOcrPrompt in useFiles");
    ocrPrompt.value = defaultOcrPrompt;
  }

  function getFile(uuid) {
    return files.value[uuid] || null;
  }

  function cleanup() {
    files.value = {};
  }

  return {
    files,
    uploadFiles,
    retrieveFiles,
    ocrFiles,
    ocrPrompt,
    resetOcrPrompt,
    getFile,
    cleanup,
  };
}