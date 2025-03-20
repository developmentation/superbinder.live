// utils/files/processorText.js
const md = markdownit({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
  });
  
  export function processText(arrayBuffer, mimeType) {
    if (!arrayBuffer) throw new Error('Invalid text input');
  
    const text = new TextDecoder().decode(arrayBuffer);
    const extension = mimeTypeToExtension[mimeType] || mimeType.split('/')[1] || 'txt';
    let pagesText = [text.replace(/\r\n|\r|\n/g, '\n')]; // Preserve line breaks
    let renderAs = 'text';
  
    switch (extension) {
      case 'md':
      case 'markdown':
        renderAs = 'markdown';
        break;
      case 'json':
        try {
          const data = JSON5.parse(text);
          pagesText = [JSON.stringify(data, null, 2)];
        } catch (error) {
          pagesText = [`Invalid JSON: ${error.message}`];
        }
        break;
      case 'html':
      case 'css':
      case 'js':
      case 'txt':
        break; // Default to raw text with preserved line breaks
      default:
        console.warn(`Unhandled text extension: ${extension}`);
    }
  
    return { pagesText, renderAs };
  }
  
  const mimeTypeToExtension = {
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'application/javascript': 'js',
    'application/json': 'json',
    'text/markdown': 'md',
  };