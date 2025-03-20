// utils/files/processorImage.js
export function processImage(arrayBuffer, mimeType) {
    if (!arrayBuffer) throw new Error('Invalid image input');
  
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    return {
      pages: [url], // URL for display
      pagesText: [''], // Placeholder for OCR
    };
  }