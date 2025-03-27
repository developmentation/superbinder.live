export const downloadFile = async (content, filename, mimeType) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };