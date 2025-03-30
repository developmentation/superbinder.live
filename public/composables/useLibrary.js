// ./composables/useLibrary.js
const libraryArtifacts = Vue.ref([]);
const loading = Vue.ref(false);
const error = Vue.ref(null);

export function useLibrary() {
  /**
   * Publish a binder to the library
   * @param {string} channelName - The channel name of the binder to publish
   * @param {string} name - The name of the library artifact
   * @param {string} description - The description of the library artifact
   * @returns {Promise<string>} - The UUID of the published artifact
   */
  async function publishBinder(channelName, name, description) {
    loading.value = true;
    error.value = null;
    try {
      const response = await axios.post('/api/library', {
        channelName,
        name,
        description,
      });
      const { uuid } = response.data;
      await fetchLibrary(); // Refresh library after publishing
      return uuid;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to publish binder';
      console.error('Publish binder failed:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch all library artifacts with votes > -5
   * @returns {Promise<void>}
   */
  async function fetchLibrary() {
    loading.value = true;
    error.value = null;
    try {
      const response = await axios.get('/api/library');
      libraryArtifacts.value = response.data.artifacts || [];
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch library';
      console.error('Fetch library failed:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Vote on a library artifact
   * @param {string} uuid - The UUID of the artifact to vote on
   * @param {'up' | 'down'} direction - The vote direction
   * @returns {Promise<void>}
   */
  async function voteArtifact(uuid, direction) {
    loading.value = true;
    error.value = null;
    try {
      const response = await axios.post('/api/library/vote', {
        uuid,
        vote: direction,
      });
      const { votes } = response.data;
      const artifact = libraryArtifacts.value.find(a => a.uuid === uuid);
      if (artifact) {
        artifact.data.votes = votes; // Update local state
      }
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to vote on artifact';
      console.error('Vote artifact failed:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Deploy a library artifact with a new channel name
   * @param {string} uuid - The UUID of the artifact to deploy
   * @param {string} channelName - The new channel name for deployment
   * @returns {Promise<void>}
   */
  async function deployArtifact(uuid, channelName) {
    loading.value = true;
    error.value = null;
    try {
      await axios.post('/api/library/deploy', {
        uuid,
        channelName,
      });
      await fetchLibrary(); // Refresh library to update copies count
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to deploy artifact';
      console.error('Deploy artifact failed:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Clear the library state
   */
  function cleanup() {
    libraryArtifacts.value = [];
    error.value = null;
    loading.value = false;
  }

  return {
    libraryArtifacts, // Reactive list of library artifacts
    loading,         // Reactive loading state
    error,           // Reactive error state
    publishBinder,
    fetchLibrary,
    voteArtifact,
    deployArtifact,
    cleanup,
  };
}