// ./composables/useFiles.js
const files = Vue.ref({});

export function useFiles() {
  async function uploadFiles(fileList, uuids = fileList.map(() => uuidv4())) {
    const formData = new FormData();
    formData.append('uuids', JSON.stringify(uuids));
    fileList.forEach((file, index) => {
      formData.append('files', file);
    });

    console.log("uploading fileList", fileList)

    try {
      const response = await axios.post('/api/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { files: results } = response.data;
      
      // Check for renaming failures
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
          // Convert base64 to Uint8Array (browser-compatible)
          const binaryString = atob(file.data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          files.value[file.uuid] = {
            filename: file.filename,
            data: bytes, // Store as Uint8Array
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
    getFile,
    cleanup,
  };
}