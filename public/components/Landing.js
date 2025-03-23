// SuperBinderLanding.js

export default {
  name: "SuperBinderLanding",
  template: `
    <div class="bg-gradient-to-b from-indigo-900 via-gray-900 to-black overflow-auto landing">
      <!-- Hero Section with Video -->
      <header class="relative h-screen flex items-center overflow-hidden">
        <video 
          class="absolute inset-0 w-full h-full object-cover opacity-60 transform scale-105" 
          autoplay 
          loop 
          muted 
          playsinline
          ref="videoEl"
        >
          <source :src="videoUrl" type="video/mp4">
        </video>
        <div class="absolute inset-0 bg-gradient-to-b from-indigo-900/20 via-gray-900/60 to-black/80"></div>
        <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-12 z-10">
          <div class="lg:grid lg:grid-cols-12 lg:gap-12 items-center">
            <div class="sm:text-center md:mx-auto lg:col-span-8 lg:text-left">
              <h1 class="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white animate-fade-in">
                SuperBinder
                <span class="block text-purple-400 mt-3">Where Humans & AI Unite in Real-Time</span>
              </h1>
              <p class="mt-6 text-xl text-gray-200 leading-relaxed max-w-3xl animate-slide-up">
                Experience real-time collaboration with humans and AI agents, managing vast document sets, dynamic sections, live chats, and more—all in one powerful, open-source platform.
              </p>
              <div class="mt-10 flex gap-6 sm:justify-center lg:justify-start animate-slide-up delay-200">
                <a href="/binder" class="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg">
                  Launch SuperBinder Now
                </a>
                <a href="#features" class="px-8 py-4 border-2 border-purple-400 hover:border-purple-300 text-purple-300 hover:text-white rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg">
                  Explore Features
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Features Section -->
      <section id="features" class="py-28 bg-gray-900">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 class="text-4xl font-bold text-center text-white mb-6 animate-fade-in">SuperBinder Unleashed</h2>
          <p class="text-gray-300 text-center mb-16 text-lg max-w-3xl mx-auto animate-fade-in delay-100">
            Dive into a world where real-time sync, AI-powered agents, and seamless collaboration redefine productivity.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div v-for="feature in features" :key="feature.title" class="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500/70 transition-all transform hover:scale-105 hover:shadow-xl">
              <div class="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <i :class="feature.icon" class="text-purple-400 text-2xl"></i>
              </div>
              <h3 class="text-xl font-semibold text-white mb-3">{{ feature.title }}</h3>
              <p class="text-gray-300 leading-relaxed">{{ feature.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Agents Screenshot Section -->
      <section class="py-28 bg-gray-800">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
            <div class="text-center lg:text-left">
              <h2 class="text-3xl font-bold text-white mb-6 animate-fade-in">Meet Your AI Agents</h2>
              <p class="text-gray-300 text-lg mb-8 max-w-xl mx-auto lg:mx-0 animate-fade-in delay-100">
                Create and customize AI agents to tackle specific tasks—analyze documents, answer questions, or generate content—all in real-time with your team.
              </p>
              <a href="/binder" class="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105 animate-fade-in delay-200">
                Deploy an Agent
              </a>
            </div>
            <div class="mt-10 lg:mt-0 animate-fade-in delay-300">
              <img :src="agentsImg" alt="SuperBinder Agents Screenshot" class="rounded-xl shadow-2xl border border-gray-700 hover:border-purple-500/50 transition-all w-full max-w-lg mx-auto">
            </div>
          </div>
        </div>
      </section>

      <!-- Sections Screenshot Section -->
      <section class="py-28 bg-gray-900">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
            <div class="order-2 lg:order-1 mt-10 lg:mt-0 animate-fade-in delay-300">
              <img :src="sectionsImg" alt="SuperBinder Sections Screenshot" class="rounded-xl shadow-2xl border border-gray-700 hover:border-purple-500/50 transition-all w-full max-w-lg mx-auto">
            </div>
            <div class="order-1 lg:order-2 text-center lg:text-left">
              <h2 class="text-3xl font-bold text-white mb-6 animate-fade-in">Organize with Sections</h2>
              <p class="text-gray-300 text-lg mb-8 max-w-xl mx-auto lg:mx-0 animate-fade-in delay-100">
                Structure your projects with dynamic sections. Drag, drop, and collaborate on documents and artifacts in a real-time tree view.
              </p>
              <a href="/binder" class="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105 animate-fade-in delay-200">
                Start Organizing
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- Tech Highlights -->
      <section class="py-28 bg-gray-800">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 class="text-4xl font-bold text-center text-white mb-12 animate-fade-in">Tech That Fuels Collaboration</h2>
          <div class="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
            <div>
              <div class="space-y-6">
                <div v-for="tech in techFeatures" :key="tech.title" class="flex items-start gap-4 animate-fade-in" :class="{ 'delay-100': tech.title !== techFeatures[0].title }">
                  <div class="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <i :class="tech.icon" class="text-purple-400 text-xl"></i>
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-white">{{ tech.title }}</h3>
                    <p class="text-gray-300">{{ tech.description }}</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-12 lg:mt-0 animate-fade-in delay-200">
              <div class="bg-gray-900 rounded-xl p-8 border border-gray-700 shadow-lg hover:border-purple-500/50 transition-all">
                <h3 class="text-xl font-semibold text-white mb-6">Our Powerhouse Stack</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div v-for="item in stack" :key="item" class="flex items-center gap-3">
                    <div class="w-3 h-3 bg-purple-400 rounded-full"></div>
                    <span class="text-gray-200 font-medium">{{ item }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Community Section -->
      <section class="py-28 bg-gray-900">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 class="text-4xl font-bold text-white mb-6 animate-fade-in">Join the SuperBinder Revolution</h2>
          <p class="text-gray-300 text-lg mb-12 max-w-2xl mx-auto animate-fade-in delay-100">
            Be part of a community shaping the future of human-AI collaboration—open source, always free, endlessly innovative.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <a href="https://github.com/developmentation/superbinder.live" target="_blank" class="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-purple-500/70 transition-all transform hover:scale-105 animate-fade-in delay-200">
              <i class="pi pi-github text-4xl text-purple-400 mb-4"></i>
              <h3 class="text-white font-semibold text-lg">GitHub</h3>
              <p class="text-gray-300 text-sm mt-2">Contribute & Innovate</p>
            </a>
            <a href="https://x.com/youralberta?lang=en" target="_blank" class="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-purple-500/70 transition-all transform hover:scale-105 animate-fade-in delay-300">
              <i class="pi pi-twitter text-4xl text-purple-400 mb-4"></i>
              <h3 class="text-white font-semibold text-lg">X</h3>
              <p class="text-gray-300 text-sm mt-2">Stay in the Loop</p>
            </a>
          </div>
        </div>
      </section>

      <!-- Call-to-Action Footer -->
      <section class="py-20 bg-gradient-to-t from-indigo-900 to-gray-900 text-center">
        <h2 class="text-3xl font-bold text-white mb-6 animate-fade-in">Ready to Collaborate Like Never Before?</h2>
        <a href="/binder" class="px-10 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-lg transition-all transform hover:scale-110 shadow-xl animate-pulse">
          Get Started Today
        </a>
      </section>
    </div>
  `,
  setup() {
    const videoEl = Vue.ref(null);
    const videoUrl = Vue.computed(() => `/assets/splashVideo.mp4`);
    const agentsImg = Vue.computed(() => `/assets/landingAgents.jpg`);
    const sectionsImg = Vue.computed(() => `/assets/landingSections.jpg`);

    Vue.onMounted(() => {
      document.documentElement.classList.add("landing-page");
      document.body.classList.add("landing-page");
      document.getElementById("app").classList.add("landing-page");

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

    const features = Vue.ref([
      {
        title: "Real-Time Everything",
        icon: "pi pi-sync",
        description: "Sync instantly with Socket.IO—chat, documents, sections, and AI updates happen live for all users."
      },
      {
        title: "Smart AI Agents",
        icon: "pi pi-microchip-ai",
        description: "Deploy custom AI agents to analyze, generate, or collaborate on your projects in real-time."
      },
      {
        title: "Document Powerhouse",
        icon: "pi pi-file",
        description: "Upload and process PDFs, DOCX, images, and more—searchable, editable, and synced across your team."
      },
      {
        title: "Dynamic Sections",
        icon: "pi pi-folder",
        description: "Organize content with a drag-and-drop tree view—sections, documents, and artifacts at your fingertips."
      },
      {
        title: "Live Chat & Collaboration",
        icon: "pi pi-comments",
        description: "Chat, vote on messages, and work together with breakout rooms—all updated instantly."
      },
      {
        title: "Open Source Freedom",
        icon: "pi pi-github",
        description: "Free forever, fully customizable, and community-driven—built for innovators like you."
      }
    ]);

    const techFeatures = Vue.ref([
      {
        icon: "pi pi-sync",
        title: "Socket.IO Real-Time Magic",
        description: "Seamless updates across all users with WebSocket power."
      },
      {
        icon: "pi pi-search",
        title: "Advanced Document Search",
        description: "Find anything fast with keyword-based content queries."
      },
      {
        icon: "pi pi-robot",
        title: "LLM Integration",
        description: "Stream AI responses live from OpenAI, Anthropic, and more."
      },
      {
        icon: "pi pi-cloud-upload",
        title: "Robust File Handling",
        description: "Process and OCR a wide range of file types effortlessly."
      }
    ]);

    const stack = Vue.ref([
      "Vue 3.5",
      "Node.js",
      "Socket.IO",
      "Tailwind CSS",
      "MongoDB",
      "ExcelJS",
      "pdfjsLib",
      "mammoth.js"
    ]);

    return {
      features,
      techFeatures,
      stack,
      videoEl,
      videoUrl,
      agentsImg,
      sectionsImg
    };
  }
};