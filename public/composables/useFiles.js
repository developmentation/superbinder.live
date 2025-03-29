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
    fileList.forEach((file, index) => {
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

  async function ocrFiles(uuids, documentData, pages) {
    const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    const maxFileSize = 7 * 1024 * 1024; // 7MB
  
    try {
      if (uuids.length !== documentData.length || uuids.length !== pages.length) {
        throw new Error('Mismatch between uuids, documentData, and pages arrays');
      }
  
      const isRawFiles = documentData.every(item => item instanceof File);
      if (!isRawFiles) {
        // Only retrieve files for non-artifact items
        const nonArtifactUuids = uuids.filter((uuid, index) => {
          const doc = documentData[index];
          return !(doc.type === 'artifact' && doc.data.type === 'image');
        });
        if (nonArtifactUuids.length > 0) {
          await retrieveFiles(nonArtifactUuids);
        }
      }
  
      const validFiles = uuids
        .map((uuid, index) => {
          let doc, file, mimeType, size;
  
          if (isRawFiles) {
            doc = documentData[index];
            file = doc;
            mimeType = doc.type;
            size = doc.size;
          } else {
            doc = documentData.find(d => d.id === uuid);
            file = files.value[uuid];
            mimeType = doc.data.mimeType;

            if (!file && doc.type === 'artifact' && doc.data.type === 'image' && doc.data.pages?.[0]) {
              // Handle artifact image directly from pages[0]
              const pageContent = doc.data.pages[0];
              if (typeof pageContent === 'string') {
                let base64Data = pageContent;
                if (pageContent.startsWith('data:image/')) {
                  base64Data = pageContent.split(',')[1];
                }
                try {
                  const binaryString = atob(base64Data);
                  const len = binaryString.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  file = bytes;
                  mimeType = 'image/jpeg'; // Always assume image/jpeg for artifact images
                  size = bytes.length;
                } catch (e) {
                  console.warn(`Invalid base64 data for artifact UUID ${uuid}:`, e, 'pageContent:', pageContent);
                  return null;
                }
              } else {
                console.warn(`No valid base64 image data for artifact UUID ${uuid}, pageContent:`, pageContent);
                return null;
              }
            } else if (!file && doc.data.type !== 'pdf') {
              console.warn(`No valid file data for UUID ${uuid}`);
              return null;
            }
          }
  
          const page = pages[index];
          if (!file && doc.data.type === 'pdf' && doc.data.pages?.[page]) {
            const pageContent = doc.data.pages[page];
            if (typeof pageContent === 'string' && pageContent.includes('<img')) {
              const parser = new DOMParser();
              const docHtml = parser.parseFromString(pageContent, 'text/html');
              const img = docHtml.querySelector('img');
              if (img && img.src.startsWith('data:image/')) {
                const base64Data = img.src.split(',')[1];
                const binaryString = atob(base64Data);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                file = bytes;
                mimeType = img.src.split(';')[0].split(':')[1];
                size = bytes.length;
              } else {
                console.warn(`No valid image found in page content for UUID ${uuid}, page ${page}`);
                return null;
              }
            } else if (typeof pageContent === 'string' && pageContent.startsWith('data:image/')) {
              const base64Data = pageContent.split(',')[1];
              const binaryString = atob(base64Data);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              file = bytes;
              mimeType = pageContent.split(';')[0].split(':')[1];
              size = bytes.length;
            } else {
              console.warn(`Unsupported page content for UUID ${uuid}, page ${page}: ${pageContent}`);
              return null;
            }
          }
  
          if (!file || !supportedMimeTypes.includes(mimeType) || size > maxFileSize) {
            console.warn(`Skipping UUID ${uuid}: file=${!!file}, mimeType=${mimeType}, size=${size}`);
            return null;
          }
  
          return { uuid, file, mimeType, size, page };
        })
        .filter(item => item !== null);
  
      if (validFiles.length === 0) {
        throw new Error('No valid files found for OCR. Supported types: image/png, image/jpeg, image/webp, application/pdf; Max size: 7MB per file');
      }
  
      const formData = new FormData();
      formData.append('prompt', ocrPrompt.value);
      await Promise.all(validFiles.map(async item => {
        const data = await (item.file instanceof Promise ? item.file : Promise.resolve(item.file));
        const blob = new Blob([data], { type: item.mimeType });
        formData.append('files', blob, item.uuid); // Use .jpg extension for artifacts
        formData.append(`mimeType_${item.uuid}`, item.mimeType);
        formData.append(`page_${item.uuid}`, item.page);
      }));
  
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
      console.error('OCR failed:', error);
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