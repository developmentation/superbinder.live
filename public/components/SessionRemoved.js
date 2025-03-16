// components/SessionRemoved.js
export default {
    name: 'SessionRemoved',
    props: {
      removedBy: {
        type: String,
        required: true,
      },
    },
    emits: ['reset-session'],
    template: `
      <div class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
          <h2 class="text-2xl font-bold text-white mb-4">Session Removed</h2>
          <p class="text-gray-300 mb-6">
            This session has been removed by {{ removedBy }} and all associated documents deleted. Feel free to create a new SuperBinder channel.
          </p>
          <button
            @click="$emit('reset-session')"
            class="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    `,
  };