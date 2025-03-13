// SuperBinderLanding.js

export default {
  name: "SuperBinderLanding",
  template: `
    <div class="bg-gradient-to-b from-indigo-900 to-gray-900 overflow-auto landing">
      <!-- Hero Section with Video -->
      <header class="relative h-screen flex items-center">
        <video 
          class="absolute inset-0 w-full h-full object-cover opacity-50" 
          autoplay 
          loop 
          muted 
          playsinline
          ref="videoEl"
        >
          <source :src="videoUrl" type="video/mp4">
        </video>
        <div class="absolute inset-0 bg-gradient-to-b from-indigo-900/10 via-indigo-900/50"></div>
        <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 z-10">
          <div class="lg:grid lg:grid-cols-12 lg:gap-8">
            <div class="sm:text-center md:mx-auto lg:col-span-8 lg:text-left">
              <h1 class="text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
                SuperBinder
                <span class="block text-purple-400 mt-2">Humans & AI, Together Live</span>
              </h1>
              <p class="mt-6 text-xl text-gray-300 leading-relaxed max-w-3xl">
                Collaborate in real-time with humans and AI agents to create and evaluate documents. Voice transcription and websocket sync make it fun and seamless!
              </p>
              <div class="mt-10 flex gap-6 sm:justify-center lg:justify-start">
                <a href="/binder" class="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105">
                  Launch SuperBinder
                </a>
                <a href="#features" class="px-8 py-3 border-2 border-indigo-400 hover:border-indigo-300 text-indigo-300 hover:text-white rounded-lg font-semibold transition-all transform hover:scale-105">
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Features Section -->
      <section id="features" class="py-24 bg-gray-900">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 class="text-3xl font-bold text-center text-white mb-4">SuperBinder Powers</h2>
          <p class="text-gray-300 text-center mb-16 text-lg max-w-3xl mx-auto">
            Discover how SuperBinder brings humans and AI together in a real-time, interactive workspace.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div v-for="feature in features" :key="feature.title" class="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all">
              <div class="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                <i :class="feature.icon" class="text-purple-400 text-2xl"></i>
              </div>
              <h3 class="text-xl font-semibold text-white mb-3">{{ feature.title }}</h3>
              <p class="text-gray-300 leading-relaxed">{{ feature.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Preview Section -->
      <section class="py-24 bg-gray-800">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div class="flex flex-col items-center gap-6 p-6 bg-gray-900 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all">
            <!-- <img :src="previewImg" alt="SuperBinder Preview" class="h-12 w-auto opacity-90" /> -->
            <h2 class="text-3xl font-bold text-white">Experience Real-Time Collaboration</h2>
            <span class="text-gray-300 text-lg">Sync up and create together.</span>
          </div>
        </div>
      </section>

      <!-- Tech Highlights -->
      <section class="py-24 bg-gray-900">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
            <div>
              <h2 class="text-3xl font-bold text-white mb-6">Tech That Binds Us</h2>
              <div class="space-y-4">
                <div v-for="tech in techFeatures" :key="tech.title" class="flex items-start gap-4">
                  <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <i :class="tech.icon" class="text-purple-400"></i>
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-white">{{ tech.title }}</h3>
                    <p class="text-gray-300">{{ tech.description }}</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-12 lg:mt-0">
              <div class="bg-gray-800 rounded-xl p-8 border border-gray-700">
                <h3 class="text-xl font-semibold text-white mb-6">Our Stack</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div v-for="item in stack" :key="item" class="flex items-center gap-3">
                    <div class="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span class="text-gray-300">{{ item }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Community Section -->
      <section class="py-24 bg-gray-800">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 class="text-3xl font-bold text-white mb-4">Join the SuperBinder Crew</h2>
          <p class="text-gray-300 text-lg mb-12 max-w-2xl mx-auto">
            Connect with others building the future of human-AI collaboration.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <a href="https://github.com/developmentation/superbinder.live" target="_blank" class="flex flex-col items-center p-6 bg-gray-900 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all">
              <i class="pi pi-github text-3xl text-purple-400 mb-4"></i>
              <h3 class="text-white font-semibold">GitHub</h3>
              <p class="text-gray-300 text-sm mt-2">Contribute & Collaborate</p>
            </a>
            <a href="https://x.com/youralberta?lang=en" target="_blank" class="flex flex-col items-center p-6 bg-gray-900 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all">
              <i class="pi pi-twitter text-3xl text-purple-400 mb-4"></i>
              <h3 class="text-white font-semibold">X</h3>
              <p class="text-gray-300 text-sm mt-2">Stay Updated</p>
            </a>
          </div>
        </div>
      </section>
    </div>
  `,
  setup() {
    const videoEl = Vue.ref(null);
    const videoUrl = Vue.computed(() => `./assets/splashVideo.mp4`);

    Vue.onMounted(() => {
      document.documentElement.classList.add("landing-page");
      document.body.classList.add("landing-page");
      document.getElementById("app").classList.add("landing-page");

      // Handle video autoplay
      if (videoEl.value) {
        videoEl.value.play().catch((e) => {
          console.warn("Autoplay failed:", e);
        });
      }
    });

    Vue.onUnmounted(() => {
      document.documentElement.classList.remove("landing-page");
      document.body.classList.remove("landing-page");
      document.getElementById("app").classList.remove("landing-page");
    });

    const previewImg = Vue.computed(() => `../assets/superbinder-preview.png`);

    const features = Vue.ref([
      {
        title: "Real-Time Sync",
        icon: "pi pi-sync",
        description: "Work together instantly with Socket.io websockets keeping everyone in sync."
      },
      {
        title: "Voice to Text",
        icon: "pi pi-microphone",
        description: "Use DeepGram’s API for real-time speech transcription right in your browser."
      },
      {
        title: "Multi-User Collaboration",
        icon: "pi pi-users",
        description: "Multiple humans and AI agents interact live on the same documents."
      },
      {
        title: "Device Harmony",
        icon: "pi pi-mobile",
        description: "Some devices listen, others research—all synced perfectly."
      },
      {
        title: "AI Outputs",
        icon: "pi pi-bolt",
        description: "See AI-generated content delivered to all users simultaneously."
      },
      {
        title: "Fun Interface",
        icon: "pi pi-star",
        description: "A lively, engaging platform that makes collaboration exciting!"
      }
    ]);

    const techFeatures = Vue.ref([
      {
        icon: "pi pi-sync",
        title: "Websocket Power",
        description: "Real-time updates via Socket.io for seamless collaboration."
      },
      {
        icon: "pi pi-microphone",
        title: "Voice Integration",
        description: "DeepGram-powered speech-to-text for instant input."
      },
      {
        icon: "pi pi-server",
        title: "Scalable System",
        description: "Handles multiple users and AI agents with ease."
      }
    ]);

    const stack = Vue.ref([
      "Vue 3.2",
      "Socket.io",
      "DeepGram",
      "Tailwind CSS",
      "WebSockets",
      "JavaScript"
    ]);

    return {
      features,
      techFeatures,
      stack,
      previewImg,
      videoEl,
      videoUrl
    };
  }
};