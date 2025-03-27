// Shared table parsing utilities
// utils/export/markdownTableUtils.js
export const normalizeTable = (content) => {
    return content
      .split('\n')
      .map(line => {
        line = line.trim();
        if (line.includes('|')) {
          line = line.startsWith('|') ? line : '| ' + line;
          line = line.endsWith('|') ? line : line + ' |';  
        }
        return line;
      })
      .filter(line => line.length > 0)
      .join('\n');
  };
  
  export const parseTable = (tableText) => {
    const lines = normalizeTable(tableText).split('\n');
    if (lines.length < 3) return null;
  
    const separatorIndex = lines.findIndex(line => 
      line.replace(/\s/g, '').match(/^\|?[\-:|]+\|?$/)
    );
    if (separatorIndex !== 1) return null;
  
    const headers = lines[0].replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
    const alignments = lines[1].replace(/^\||\|$/g, '').split('|').map(cell => {
      const clean = cell.trim();
      if (clean.startsWith(':') && clean.endsWith(':')) return 'center';
      if (clean.endsWith(':')) return 'right';
      return 'left';
    });
    const rows = lines.slice(2)
      .filter(line => line.includes('|'))
      .map(line => {
        const cells = line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
        while (cells.length < headers.length) cells.push('');
        return cells.slice(0, headers.length);
      });
  
    return { headers, alignments, rows, columnCount: headers.length };
  };
  
  export const cleanContent = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .trim();
  };