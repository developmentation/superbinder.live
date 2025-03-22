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

  async function ocrFiles(uuids, documentData) {
    const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const maxFileSize = 7 * 1024 * 1024; // 7MB in bytes per file

    try {
      // Fetch files if not already in memory
      await retrieveFiles(uuids);

      // Filter files based on MIME types and size
      const validFiles = uuids
        .map(uuid => {
          const doc = documentData.find(d => d.id === uuid);
          const file = files.value[uuid];
          return {
            uuid,
            file,
            mimeType: doc?.data.mimeType,
            size: doc?.data.size, // Size in bytes from document entity
          };
        })
        .filter(item => 
          item.file && 
          supportedMimeTypes.includes(item.mimeType) && 
          (item.size <= maxFileSize)
        );

      if (validFiles.length === 0) {
        throw new Error('No valid files found for OCR. Supported types: image/png, image/jpeg, image/webp; Max size: 7MB per file');
      }

      const formData = new FormData();
      validFiles.forEach(item => {
        const blob = new Blob([item.file.data], { type: item.mimeType });
        formData.append('files', blob, item.uuid);
        formData.append(`mimeType_${item.uuid}`, item.mimeType); // Pass MIME type for each file
      });

      const response = await axios.post('/api/files/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return response.data.text; // Array of OCR results
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