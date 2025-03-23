
# SuperBinder.live

SuperBinder.live is a cutting-edge, open-source platform that redefines real-time collaboration. It seamlessly unites humans and AI agents to manage expansive document sets, organize content with dynamic sections, chat live, deploy custom AI agents, and process a wide range of file types—all synchronized instantly across all participants. Whether you're brainstorming with a team, analyzing documents with AI, or structuring complex projects, SuperBinder.live delivers a powerful, intuitive experience.

_This is a template to kickstart your journey! Fork it, build your app, and make it your own with a feature branch or a full fork._

## Major Features

### Real-Time Collaboration & Session Management
- **Instant Sync**: Powered by Socket.IO WebSockets, every action—document uploads, chat messages, section updates, AI responses—syncs in real time across all users, ensuring a cohesive experience.
- **Session Flexibility**: Join or create sessions effortlessly with a channel name and display name—no login required. Sessions persist locally via `sessionStorage`, auto-reconnecting on refresh, with a removal modal for cleanup.
- **User Presence**: See who’s active with unique UUIDs, display names, and color-coded avatars, updated live as users join or leave.

### Advanced Document Management
- **Upload Anything**: Supports a vast array of file types—PDFs (`.pdf`), Word docs (`.docx`), Excel sheets (`.xlsx`), text files (`.txt`, `.md`, `.html`, `.js`, `.json`, `.css`), images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`), and more. Files process client-side and sync instantly.
- **Rich Viewing**: View documents with preserved formatting—tables, images, charts, and styles intact. Navigate multi-page files with lazy-loaded precision via `LazyScrollViewer`.
- **Edit & Organize**: Rename or remove documents with real-time updates. Associate files with sections for structured project management.
- **Search Power**: Search document content with keyword matching, returning ranked results with snippets, metadata, and timestamps.

### Dynamic Section & Artifact Organization
- **Tree-Based Structure**: Build and navigate a real-time section tree with drag-and-drop reordering, expandable nodes, and multi-select modals for bulk actions.
- **Artifacts**: Create, edit, and sync artifacts (e.g., notes, AI outputs) collaboratively within sections, with live updates broadcast to all users.

### Live Chat & Collaboration
- **Group Chat**: Engage in real-time messaging with drafts, colored user messages, and auto-scrolling. Toggle between desktop sidebar and mobile fullscreen views.
- **Breakout Rooms**: Create and manage breakout rooms for focused collaboration, with synced updates and room selection UI.
- **Interactive Features**: Vote on messages, mention users or AI agents with `@displayName`, and see typing indicators—all live.

### AI Agents & LLM Integration
- **Custom Agents**: Deploy AI agents with tailored prompts to analyze documents, answer queries, or generate content, synced across the session.
- **LLM Streaming**: Trigger real-time responses from models like OpenAI, Anthropic, or xAI, with streaming outputs displayed live in the chat or viewer.
- **Agent Management**: Add, edit, or remove agents via a grid UI, with filtering by name or description.

### File Processing & OCR
- **Robust Processing**: 
  - PDFs: Extract text and rasterize pages with `pdfjsLib`.
  - DOCX: Convert to HTML with `mammoth.js`, preserving styles and splitting pages.
  - Excel/CSV: Parse with `ExcelJS` into JSON, handling headers and data rows.
  - Text/Markdown: Decode and render with formatting intact.
  - Images: Generate URLs with OCR placeholders for future text extraction.
- **OCR Integrated**: Currently uses the powerful Gemini 2.0 for rapid image OCR.

### GitHub & Web Integration
- **GitHub Content**: Load repository trees or specific files via API, integrating external codebases into your session.
- **Web Scraping**: Fetch and process web content from URLs, enhancing document sets with real-time data.

### Responsive & Accessible Design
- **Cross-Device**: Adapts seamlessly—multi-column layouts on desktop, stacked full-width on mobile—with Tailwind CSS.
- **Accessibility**: Keyboard-navigable UI with ARIA attributes and high-contrast visuals for inclusivity.

---

## Installation

### Prerequisites
- **Node.js**: v20 or later recommended
- **npm**: v9+ (or **yarn** if preferred)
- **Git**: For cloning the repository
- Optional: **nodemon** for development server auto-restart

### Setup Steps
1. **Clone the Repository**
   ```bash
   git clone https://github.com/developmentation/superbinder.live.git
   cd superbinder-live
   ```

2. **Install Dependencies**
   Using npm:
   ```bash
   npm install
   ```

3. **Configure Environment**
   - Copy the example `.env` file and add your API keys (e.g., LLM providers):
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` with your keys, e.g.:
     ```
     OPENAI_API_KEY=your_openai_key
     PORT=3000
     ```

4. **Start the Development Server**
   - Install `nodemon` globally (if not already installed):
     ```bash
     npm install -g nodemon
     ```
     Or as a dev dependency:
     ```bash
     npm install --save-dev nodemon
     ```
   - Launch the server:
     ```bash
     nodemon index.js
     ```

5. **Access the Application**
   - Open your browser to `http://localhost:3000` (or the port specified in `.env`).

---

## Usage
- **Start a Session**: Enter a channel name and display name on the landing page to join or create a session.
- **Upload Documents**: Drag-and-drop or select files to share instantly with your team.
- **Collaborate**: Chat, create sections, deploy AI agents, and explore content—all in real time.
- **Explore Features**: Use the tabbed interface (Dashboard, Sections, Agents, etc.) to manage your workspace.

Detailed usage guides are forthcoming—stay tuned!

---

## Technologies Used
- **Vue.js 3.5**: Reactive frontend with Composition API for scalable logic.
- **Socket.IO**: WebSocket-driven real-time communication.
- **Tailwind CSS**: Utility-first styling for a modern, responsive UI.
- **pdfjsLib**: PDF text extraction and rasterization.
- **mammoth.js**: DOCX-to-HTML conversion.
- **ExcelJS**: Excel and CSV parsing.
- **MongoDB**: Backend data storage (optional, depending on fork).
- **LLM Providers**: OpenAI, Anthropic, xAI, etc., for AI outputs.
- **Node.js**: Server-side runtime.

---

## Contributing
Join the revolution! SuperBinder.live thrives on community input—report bugs, suggest features, or submit code to make it even better.

1. **Fork the Repository**
   - Click "Fork" on GitHub to create your copy.

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/YourFeatureName
   ```

3. **Commit Your Changes**
   ```bash
   git commit -m "Add your feature description"
   ```

4. **Push to Your Branch**
   ```bash
   git push origin feature/YourFeatureName
   ```

5. **Open a Pull Request**
   - Go to your forked repo on GitHub and click "New Pull Request" to submit your changes.

Ensure your code follows the project’s style guide (e.g., ESLint, Prettier) and passes tests before submitting.

---

## License
Licensed under the [MIT License](https://en.wikipedia.org/wiki/MIT_License)—free to use, modify, and share.

---

## Get Involved
SuperBinder.live is free always. Fork it, tweak it, and build the future of human-AI collaboration with us. Visit us on [GitHub](https://github.com/developmentation/superbinder.live) or follow updates on [X](https://x.com/youralberta?lang=en).
 