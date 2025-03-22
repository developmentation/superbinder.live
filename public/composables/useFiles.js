// ./composables/useFiles.js
const files = Vue.ref({});

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
    const maxFileSize = 7 * 1024 * 1024; // 7MB in bytes per file

    try {
      // Validate inputs
      if (uuids.length !== documentData.length || uuids.length !== pages.length) {
        throw new Error('Mismatch between uuids, documentData, and pages arrays');
      }

      // Fetch files if not already in memory
      await retrieveFiles(uuids);

      // Filter and prepare files based on MIME types, size, and page data
      const validFiles = uuids
        .map((uuid, index) => {
          const doc = documentData.find(d => d.id === uuid);
          const file = files.value[uuid];
          const page = pages[index];
          if (!file || !doc || !supportedMimeTypes.includes(doc.data.mimeType) || doc.data.size > maxFileSize) {
            return null;
          }

          let blobData;
          let mimeType = doc.data.mimeType;

          if (mimeType === 'application/pdf' && doc.data.pages?.[page]) {
            const pageContent = doc.data.pages[page];
            if (typeof pageContent === 'string' && pageContent.includes('<img')) {
              // Parse HTML to extract the image src
              const parser = new DOMParser();
              const docHtml = parser.parseFromString(pageContent, 'text/html');
              const img = docHtml.querySelector('img');
              if (img && img.src.startsWith('data:image/')) {
                const base64Data = img.src.split(',')[1]; // Extract base64 part after "data:image/png;base64,"
                const binaryString = atob(base64Data);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                blobData = bytes;
                mimeType = img.src.split(';')[0].split(':')[1]; // e.g., "image/png"
              } else {
                console.warn(`No valid image found in page content for UUID ${uuid}, page ${page}`);
                return null;
              }
            } else if (typeof pageContent === 'string' && pageContent.startsWith('data:image/')) {
              // Direct base64 data URL
              const base64Data = pageContent.split(',')[1];
              const binaryString = atob(base64Data);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              blobData = bytes;
              mimeType = pageContent.split(';')[0].split(':')[1];
            } else {
              // Assume it's a URL to fetch
              blobData = fetch(pageContent).then(res => res.blob()).then(blob => blob.arrayBuffer());
              mimeType = 'image/png'; // Assume PNG for rasterized pages
            }
          } else {
            // For non-PDFs (images), use the file data directly
            blobData = file.data;
          }

          return {
            uuid,
            file: blobData,
            mimeType,
            size: doc.data.size,
            page,
          };
        })
        .filter(item => item !== null);

      if (validFiles.length === 0) {
        throw new Error('No valid files found for OCR. Supported types: image/png, image/jpeg, image/webp, application/pdf; Max size: 7MB per file');
      }

      const formData = new FormData();
      await Promise.all(validFiles.map(async item => {
        const data = await (item.file instanceof Promise ? item.file : Promise.resolve(item.file));
        const blob = new Blob([data], { type: item.mimeType });
        formData.append('files', blob, item.uuid);
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

      // Ensure response matches request order
      const results = uuids.map(uuid => {
        const index = responseUuids.indexOf(uuid);
        return {
          uuid,
          text: index !== -1 ? text[index] : null,
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
    getFile,
    cleanup,
  };
}