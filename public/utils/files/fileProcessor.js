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

// Initialize markdown parser (using your syntax)
const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  references: {},
});

// Custom CSS for styled Word/PDF output
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

export async function processFile(file) {
  const uuid = uuidv4();
  const extension = file.name.split('.').pop().toLowerCase();
  const originalMetadata = {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
  };
  const newMetadata = {
    id: uuid,
    name: file.name,
    type: extension, // Ensure type is included
  };
  let status = 'pending';
  let originalContent = '';
  let processedContent = '';
  let pages = []; // Track pages for navigation
  let analysisContent = {
    summary: null,
    knowledgeGraph: { edges: [], nodes: [] },
    keywords: [],
    vectors: null,
  };

  try {
    // Read file content
    originalContent = await readFileContent(file);

    // Process based on file type
    switch (extension) {
      case 'docx':
        const docxResult = await processDocx(originalContent);
        processedContent = docxResult.html; // Ensure HTML is not escaped
        if (processedContent.includes('<')) {
          processedContent = `${wordStyles}<div class="document-content">${processedContent}</div>`;
        }
        pages = docxResult.pages || [];
        break;
        case 'pdf':
          const pdfResult = await processPdf(file);
          processedContent = pdfResult.html;
          if (processedContent.includes('<')) {
            processedContent = `${wordStyles}<div class="pdf-container">${processedContent}</div>`;
          }
          pages = pdfResult.pages || [];
          break;
      case 'md':
        processedContent = await processMarkdown(originalContent);
        break;
      case 'xlsx':
        processedContent = await processExcel(file);
        if (processedContent.includes('<')) {
          processedContent = `${wordStyles}<div class="document-content">${processedContent}</div>`;
        }
        break;
      case 'json':
        processedContent = await processJson(originalContent);
        break;
      case 'txt':
      case 'js':
      case 'html':
      case 'css':
        // Render as plain text without HTML interpretation
        processedContent = escapeHtml(originalContent);
        break;
      default:
        if (isTextFile(file)) {
          processedContent = escapeHtml(originalContent); // Plain text rendering
        } else {
          throw new Error('Unsupported file type');
        }
    }

    // Placeholder AI analysis (implement later)
    analysisContent = {
      summary: 'AI summary placeholder (to be implemented)',
      knowledgeGraph: { edges: [], nodes: [] },
      keywords: ['keyword1', 'keyword2'], // Placeholder keywords
      vectors: null, // Placeholder for embeddings
    };

    status = 'complete';
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    status = 'error';
    processedContent = `<p>Error processing file: ${error.message}</p>`;
  }

  return {
    ...originalMetadata,
    ...newMetadata,
    originalContent,
    processedContent,
    analysisContent,
    status,
    timestamp: Date.now(),
    pages, // Include pages for navigation
  };
}

// Helper functions (unchanged except for context)
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    if (file.type.startsWith('text/') || file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      reader.readAsArrayBuffer(file);
    } else if (file.type === 'application/pdf') {
      reader.readAsArrayBuffer(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      reader.readAsArrayBuffer(file); // For .xlsx
    } else {
      reader.readAsText(file);
    }
  });
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

  return { html: result.value, pages }; // Ensure the HTML is returned as is, not escaped
}

async function processPdf(file) {
  const loadingTask = pdfjsLib.getDocument({ data: await file.arrayBuffer() });
  const pdf = await loadingTask.promise;

  let html = '';
  const pages = [];

  // Set scale for 300 DPI (300 / 72 = ~4.1667)
  const scale = 4.1667;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    // Create a canvas for rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render the page to the canvas
    const renderTask = page.render({
      canvasContext: context,
      viewport: viewport,
      enableWebGL: true, // Optional: improves performance if supported
    });

    await renderTask.promise;

    // Convert canvas to image data URL
    const dataUrl = canvas.toDataURL('image/png', 0.95); // 0.95 quality for PNG

    // Build HTML for the page
    const pageContent = `
      <div class="pdf-page" style="position: relative; width: ${viewport.width}px; height: ${viewport.height}px; margin: 20px 0;">
        <img src="${dataUrl}" style="width: 100%; height: 100%; user-select: none;" alt="Page ${i}" />
      </div>
    `;

    pages.push(pageContent);
    html += pageContent;

    // Clean up canvas
    canvas.remove();
  }

  return { html, pages };
}
// Helper function for images (updated to include positioning)
async function getPageImages(page, pageNumber) {
  const images = [];
  try {
    const opList = await page.getOperatorList();
    const viewport = page.getViewport({ scale: 1.0 });
    const fns = opList.fnArray;
    const args = opList.argsArray;
    const processedRefs = new Set();

    for (let i = 0; i < fns.length; i++) {
      const fn = fns[i];
      const arg = args[i];

      if ([
        pdfjsLib.OPS.paintJpegXObject,
        pdfjsLib.OPS.paintImageXObject,
        pdfjsLib.OPS.paintImageMaskXObject,
        pdfjsLib.OPS.paintInlineImageXObject,
        pdfjsLib.OPS.paintFormXObject,
        pdfjsLib.OPS.beginInlineImage,
      ].includes(fn)) {
        let imgKey = arg[0];
        if (fn === pdfjsLib.OPS.beginInlineImage) {
          imgKey = `inline_${pageNumber}_${i}`;
        }

        if (processedRefs.has(imgKey)) continue;
        processedRefs.add(imgKey);

        let imageData;
        if (fn === pdfjsLib.OPS.beginInlineImage) {
          const imageDict = arg[0];
          const imageBytes = arg[1];
          imageData = {
            width: imageDict.width,
            height: imageDict.height,
            data: imageBytes,
            kind: imageDict.colorSpace ? 'RGB' : 'RGBA',
          };
        } else {
          imageData = await new Promise((resolve) => {
            page.objs.get(imgKey, (img) => resolve(img));
          });
        }

        if (!imageData) continue;

        const canvas = document.createElement('canvas');
        let x = 0, y = 0; // Default position (to be refined)
        if (fn === pdfjsLib.OPS.paintFormXObject) {
          const formViewport = page.getViewport({ scale: 1.0 });
          canvas.width = formViewport.width;
          canvas.height = formViewport.height;
          const ctx = canvas.getContext('2d');
          const renderContext = { canvasContext: ctx, viewport: formViewport, enableWebGL: true };
          await page.render(renderContext).promise;
          x = 0; y = 0; // Adjust based on form position if available
        } else if (imageData.bitmap) {
          canvas.width = imageData.bitmap.width;
          canvas.height = imageData.bitmap.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imageData.bitmap, 0, 0);
          x = 0; y = 0; // Adjust based on position in PDF (if available)
        } else if (imageData.data) {
          canvas.width = imageData.width;
          canvas.height = imageData.height;
          const ctx = canvas.getContext('2d');
          let imgData;
          if (imageData.kind === 'RGB') {
            const rgba = new Uint8ClampedArray(imageData.width * imageData.height * 4);
            for (let j = 0; j < imageData.data.length; j += 3) {
              const k = (j / 3) * 4;
              rgba[k] = imageData.data[j];
              rgba[k + 1] = imageData.data[j + 1];
              rgba[k + 2] = imageData.data[j + 2];
              rgba[k + 3] = 255;
            }
            imgData = new ImageData(rgba, imageData.width, imageData.height);
          } else {
            imgData = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
          }
          ctx.putImageData(imgData, 0, 0);
          x = 0; y = 0; // Adjust based on position in PDF (if available)
        }

        const dataUrl = canvas.toDataURL('image/png', 0.95);
        const blob = await new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png', 0.95));

        if (dataUrl) {
          images.push({
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            pageNumber,
            id: imgKey,
            x: x, // Position X (to be refined)
            y: y, // Position Y (to be refined)
            viewport: { width: viewport.width, height: viewport.height },
          });
        }
      }
    }

    if (images.length === 0) {
      const hasText = await hasTextContent(page);
      if (!hasText) {
        const scale = 2.0;
        const scaledViewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const ctx = canvas.getContext('2d');
        const renderContext = { canvasContext: ctx, viewport: scaledViewport, enableWebGL: true };
        await page.render(renderContext).promise;
        const dataUrl = canvas.toDataURL('image/png', 0.95);
        const blob = await new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png', 0.95));

        if (dataUrl) {
          images.push({
            dataUrl,
            width: scaledViewport.width,
            height: scaledViewport.height,
            pageNumber,
            id: `page-${pageNumber}`,
            x: 0, // Default position
            y: 0, // Default position
            viewport: { width: viewport.width, height: viewport.height },
          });
        }
      }
    }

    return images;
  } catch (error) {
    console.log("Parsing error", error);
  }
}

async function hasTextContent(page) {
  const textContent = await page.getTextContent({
    includeMarkedContent: true,
    disableCombineTextItems: false,
  });
  return textContent.items.some((item) => (item.str || "").trim().length > 0);
}

async function processMarkdown(text) {
  return md.render(text);
}

async function processExcel(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file);
  let html = '<table class="border-collapse border border-gray-500">';
  workbook.eachSheet((worksheet) => {
    html += `<tr><th colspan="${worksheet.columnCount}" class="bg-gray-600 text-white p-2">${worksheet.name}</th></tr>`;
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      html += '<tr>';
      row.eachCell({ includeEmpty: false }, (cell) => {
        html += `<td class="border border-gray-500 p-2">${cell.value || ''}</td>`;
      });
      html += '</tr>';
    });
  });
  html += '</table>';
  return html;
}

async function processJson(text) {
  try {
    const data = JSON5.parse(text);
    return `<pre class="bg-gray-800 p-2 rounded-lg">${JSON.stringify(data, null, 2)}</pre>`;
  } catch (error) {
    return `<p>Invalid JSON: ${error.message}</p>`;
  }
}

function isTextFile(file) {
  return file.type.startsWith('text/') || ['.js', '.css', '.html', '.txt'].some(ext => file.name.endsWith(ext));
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '\'');
}