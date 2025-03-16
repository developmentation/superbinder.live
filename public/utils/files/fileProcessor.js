// utils/files/fileProcessor.js

// Ensure pdfjsLib is globally available (assuming it's imported or loaded via CDN)
// If not, ensure it's imported here: import * as pdfjsLib from 'pdfjs-dist'; window.pdfjsLib = pdfjsLib;

// Utility functions from parsePdf.js for worker configuration
const getPdfResourcePath = () => {
  const scripts = document.getElementsByTagName("script");
  let pdfJsPath = "";

  for (const script of scripts) {
    if (script.src.includes("pdf.min.js")) {
      pdfJsPath = new URL(script.src);
      break;
    }
  }

  if (!pdfJsPath) {
    pdfJsPath = new URL(window.location.origin);
  }

  return new URL("./plugins/", pdfJsPath).href;
};

const configurePdfWorker = () => {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const basePath = getPdfResourcePath();
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${basePath}pdf.worker.min.mjs`;
    }
  } catch (error) {
    throw new Error(`Failed to configure PDF.js worker: ${error.message}`);
  }
};

// Configure worker immediately
configurePdfWorker();

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  references: {},
});

const wordStyles = `
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; padding: 8px; }
    th { background-color: #f2f2f2; font-weight: bold; }
    .mammoth-shading { background-color: #e6e6e6; }
    .mammoth-table { border: 1px solid #000; }
    .mammoth-page-break { page-break-before: always; }
    .pdf-page { position: relative; margin: 20px 0; user-select: text; }
    pre { background-color: #1e293b; padding: 8px; border-radius: 4px; overflow-x: auto; }
    .pdf-text { position: absolute; color: #000; user-select: text; font-family: Arial, sans-serif; }
    .pdf-image { position: absolute; user-select: none; }
    .pdf-container { max-width: 100%; overflow-x: auto; }
  </style>
`;

// Map MIME types to extensions for processing
const mimeTypeToExtension = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/css': 'css',
  'application/javascript': 'js',
  'application/json': 'json',
  'text/markdown': 'md',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export async function processFile(arrayBuffer, mimeType) {
  if (!arrayBuffer || !mimeType) {
    throw new Error('Invalid input: missing arrayBuffer or mimeType');
  }

  const uuid = uuidv4();
  const extension = mimeTypeToExtension[mimeType] || mimeType.split('/')[1] || 'bin'; // Use mapped extension or fallback
  const originalMetadata = {
    type: extension,
    size: arrayBuffer.byteLength,
  };
  const newMetadata = {
    id: uuid,
  };
  let status = 'pending';
  let processedContent = '';
  let pages = [];
  let pagesText = [];
  let originalContent = arrayBuffer;
  let analysisContent = {
    summary: null,
    knowledgeGraph: { edges: [], nodes: [] },
    keywords: [],
    vectors: null,
  };

  try {
    const content = new Uint8Array(arrayBuffer);

    if (extension === 'pdf') {
      const pdfResult = await processPdf(content.buffer);
      pages = pdfResult.pages;
      pagesText = pdfResult.textContent || [];
      console.log('PDF pagesText:', pagesText);
    } else if (extension === 'docx') {
      const docxResult = await processDocx(content.buffer);
      processedContent = docxResult.html;
      if (processedContent.includes('<')) {
        processedContent = `${wordStyles}<div class="document-content">${processedContent}</div>`;
      }
      pagesText = docxResult.pages; // Treat sections as pages (future enhancement for true page breaking)
    } else if (isTextBased(mimeType)) {
      const text = new TextDecoder().decode(content);
      processedContent = processTextContent(text, extension);
      pagesText = [text]; // Single page for text-based files
    } else {
      throw new Error('Unsupported file type for processing');
    }

    analysisContent = {
      summary: 'AI summary placeholder (to be implemented)',
      knowledgeGraph: { edges: [], nodes: [] },
      keywords: ['keyword1', 'keyword2'],
      vectors: null,
    };

    status = 'complete';
  } catch (error) {
    console.error(`Error processing file:`, error);
    status = 'error';
    processedContent = `<p>Error processing file: ${error.message}</p>`;
    pages = [];
    pagesText = [];
  }

  const processedData = {
    ...originalMetadata,
    ...newMetadata,
    processedContent,
    pages,
    pagesText,
    originalContent,
    analysisContent,
    status,
    timestamp: Date.now(),
    renderAsHtml: extension === 'pdf' ? true : processedContent.includes('<'),
  };

  console.log('Processed Data:', processedData);

  return {
    id: uuid,
    data: processedData,
  };
}

// Function to regenerate PDF pages from originalContent
export async function regeneratePdfPages(arrayBuffer) {
  if (!arrayBuffer) return { pages: [], textContent: [] };

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages = [];
  const textContent = [];
  const scale = 2;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const textContentItems = await page.getTextContent({
      includeMarkedContent: true,
      disableCombineTextItems: false,
    });
    const pageText = textContentItems.items
      .map(item => item.str || '')
      .join(' ')
      .trim();
    textContent.push(pageText);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderTask = page.render({
      canvasContext: context,
      viewport: viewport,
      enableWebGL: true,
    });

    await renderTask.promise;
    const dataUrl = canvas.toDataURL('image/png', 0.95);

    const pageContent = `
      <div class="pdf-page" style="position: relative; width: ${viewport.width}px; height: ${viewport.height}px; margin: 20px 0;">
        <img src="${dataUrl}" style="width: 100%; height: 100%; user-select: none;" alt="Page ${i}" />
      </div>
    `;

    pages.push(pageContent);
    canvas.remove();
  }

  return { pages, textContent };
}

// Helper functions
async function processPdf(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let html = '';
  const pages = [];
  const textContent = [];

  const scale = 1.25;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const textContentItems = await page.getTextContent({
      includeMarkedContent: true,
      disableCombineTextItems: false,
    });
    const pageText = textContentItems.items
      .map(item => item.str || '')
      .join(' ')
      .trim();
    textContent.push(pageText);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderTask = page.render({
      canvasContext: context,
      viewport: viewport,
      enableWebGL: true,
    });

    await renderTask.promise;
    const dataUrl = canvas.toDataURL('image/png', 0.95);

    const pageContent = `
      <div class="pdf-page" style="position: relative; width: ${viewport.width}px; height: ${viewport.height}px; margin: 20px 0;">
        <img src="${dataUrl}" style="width: 100%; height: 100%; user-select: none;" alt="Page ${i}" />
      </div>
    `;

    pages.push(pageContent);
    html += pageContent;

    canvas.remove();
  }

  return { pages, textContent };
}

async function processDocx(buffer) {
  const result = await mammoth.convertToHtml({
    arrayBuffer: buffer,
    options: {
      styleMap: [
        'p[style-name="Heading 1"] => h1:fresh',
        'p[style-name="Heading 2"] => h2:fresh',
        'table => table.mammoth-table:fresh',
        'tr => tr:fresh',
        'td => td:fresh',
        'th => th:fresh',
        'p[w:valign="center"] => p.mammoth-center:fresh',
        'p[w:shd="clear" w:fill="..." w:themeFill="..."] => p.mammoth-shading:fresh',
      ],
      transformDocument: (element) => {
        if (element.children && element.children.some(child => child.type === 'sectionBreak')) {
          return {
            type: 'tag',
            name: 'div',
            children: element.children,
            attributes: { class: 'mammoth-page-break' },
          };
        }
        return element;
      },
    },
  });

  const pages = [];
  let currentPageContent = '';
  result.value.split('<div class="mammoth-page-break">').forEach((section, index) => {
    if (index > 0) {
      pages.push(currentPageContent);
      currentPageContent = section;
    } else {
      currentPageContent = section;
    }
  });
  if (currentPageContent) pages.push(currentPageContent);

  return { html: result.value, pages };
}

function processTextContent(text, extension) {
  switch (extension) {
    case 'docx':
      // Note: Page breaking for DOCX is not supported yet; future enhancement
      return `${wordStyles}<div class="document-content">${escapeHtml(text)}</div>`;
    case 'md':
      return md.render(text);
    case 'txt':
    case 'js':
    case 'html':
    case 'css':
      return escapeHtml(text);
    case 'json':
      try {
        const data = JSON5.parse(text);
        return `<pre class="bg-gray-800 p-2 rounded-lg">${JSON.stringify(data, null, 2)}</pre>`;
      } catch (error) {
        return `<p>Invalid JSON: ${error.message}</p>`;
      }
    default:
      return escapeHtml(text);
  }
}

function isTextBased(mimeType) {
  return mimeType.startsWith('text/') || ['application/json', 'application/javascript', 'text/markdown'].includes(mimeType);
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '\'');
}