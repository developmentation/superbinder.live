// utils/files/processorPDF.js
// Assumes pdfjsLib is globally available

const configurePdfWorker = () => {
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        const scripts = document.getElementsByTagName("script");
        let pdfJsPath = "";
        for (const script of scripts) {
          if (script.src.includes("pdf.min.js")) {
            pdfJsPath = new URL(script.src);
            break;
          }
        }
        if (!pdfJsPath) pdfJsPath = new URL(window.location.origin);
        pdfjsLib.GlobalWorkerOptions.workerSrc = `${new URL("./plugins/", pdfJsPath).href}pdf.worker.min.mjs`;
      }
    } catch (error) {
      throw new Error(`Failed to configure PDF.js worker: ${error.message}`);
    }
  };
  configurePdfWorker();
  
  export async function extractPDFText(arrayBuffer) {
    if (!arrayBuffer) throw new Error('Invalid PDF input');
  
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const textContent = [];
  
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContentItems = await page.getTextContent({
        includeMarkedContent: true,
        disableCombineTextItems: false,
      });
      const pageText = textContentItems.items
        .map(item => item.str || '')
        .join(' ')
        .trim();
      textContent.push(pageText);
    }
  
    return { pagesText: textContent };
  }
  
  export async function rasterizePDF(arrayBuffer) {
    if (!arrayBuffer) throw new Error('Invalid PDF input');
  
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const pages = [];
    const scale = 2.5;
  
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
  
      await page.render({
        canvasContext: context,
        viewport,
        enableWebGL: true,
      }).promise;
  
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      const pageContent = `
        <div class="pdf-page" style="position: relative; width: ${viewport.width}px; height: ${viewport.height}px; margin: 20px 0;">
          <img src="${dataUrl}" style="width: 100%; height: 100%; user-select: none;" alt="Page ${i}" />
        </div>
      `;
      pages.push(pageContent);
      canvas.remove();
    }
  
    return { pages };
  }