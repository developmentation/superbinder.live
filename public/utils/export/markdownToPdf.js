import { parseTable, cleanContent } from './markdownTableUtils.js';

const DEFAULT_STYLES = {
  colors: { header: '#1a1a1a', text: '#333333', tableHeader: '#666666', tableBorder: '#CCCCCC', tableHeaderBg: '#F5F5F5' },
  headerStyles: { h1: { fontSize: 24, spacing: 6 }, h2: { fontSize: 20, spacing: 5 }, h3: { fontSize: 16, spacing: 4 } },
  margins: { left: 15, right: 15, bottom: 20 },
  table: { cell: { padding: 5, lineHeight: 10 } }
};

export const markdownToPdf = (markdown, options = {}) => {
  const styles = { ...DEFAULT_STYLES, ...options };
  const pdf = new jspdf.jsPDF();
  const md = markdownit({ html: true, breaks: true, linkify: true, typographer: true });
  
  // Preprocess markdown to remove code block markers
  const processedMarkdown = markdown.replace(/```(?:markdown|json|[a-z]*)\n([\s\S]*?)```/gi, '$1');
  const tokens = md.parse(processedMarkdown, {});

  let y = 25;
  const pageWidth = pdf.internal.pageSize.width;
  const contentWidth = pageWidth - styles.margins.left - styles.margins.right;
  const pageHeight = pdf.internal.pageSize.height;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (y + 20 > pageHeight - styles.margins.bottom) {
      pdf.addPage();
      y = 25;
    }

    switch (token.type) {
      case 'heading_open': {
        const level = token.tag;
        const style = styles.headerStyles[level];
        const nextToken = tokens[++i];
        if (nextToken.type === 'inline') {
          pdf.setFontSize(style.fontSize);
          pdf.setTextColor(styles.colors.header);
          const wrappedText = pdf.splitTextToSize(nextToken.content, contentWidth);
          pdf.text(wrappedText, styles.margins.left, y);
          y += (wrappedText.length * (style.fontSize / 3)) + style.spacing;
        }
        break;
      }
      case 'paragraph_open':
      case 'blockquote_open': { // Treat blockquotes as regular paragraphs
        const nextToken = tokens[++i];
        if (nextToken.type === 'inline') {
          pdf.setFontSize(12);
          pdf.setTextColor(styles.colors.text);
          const lines = nextToken.content.split('\n');
          lines.forEach((line, j) => {
            const wrappedText = pdf.splitTextToSize(line, contentWidth);
            pdf.text(wrappedText, styles.margins.left, y + (j * 5));
            y += wrappedText.length * 5;
          });
          y += 2;
        }
        break;
      }
      case 'code_block':
      case 'fence': {
        pdf.setFont('courier');
        pdf.setFontSize(11);
        pdf.setTextColor(styles.colors.text);
        const lines = token.content.split('\n');
        const lineHeight = 5; // Define line height for code block
        let currentY = y;
        lines.forEach((line, j) => {
          const wrappedText = pdf.splitTextToSize(line, contentWidth);
          wrappedText.forEach((wrappedLine, k) => {
            pdf.text(wrappedLine, styles.margins.left, currentY + (j * lineHeight) + (k * lineHeight));
          });
          currentY += wrappedText.length * lineHeight; // Increment y by the number of wrapped lines for this line
        });
        y = currentY + 4; // Update y after all lines are processed
        break;
      }
      case 'table_open': {
        const tableData = parseTableFromTokens(tokens, i);
        if (tableData) {
          y += drawTable(pdf, tableData, styles.margins.left, y, contentWidth, styles) + 10;
          while (i < tokens.length && tokens[i].type !== 'table_close') i++;
        }
        break;
      }
    }
  }

  return pdf.output('arraybuffer');
};

const parseTableFromTokens = (tokens, startIndex) => {
  let headers = [];
  let rows = [];
  let currentRow = [];
  let inHeader = false;

  for (let i = startIndex; i < tokens.length && tokens[i].type !== 'table_close'; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 'thead_open': inHeader = true; break;
      case 'tbody_open': inHeader = false; break;
      case 'tr_open': currentRow = []; break;
      case 'tr_close': 
        if (inHeader) headers = currentRow;
        else rows.push(currentRow);
        currentRow = [];
        break;
      case 'th_open':
      case 'td_open':
        const nextToken = tokens[++i];
        if (nextToken.type === 'inline') currentRow.push(nextToken.content);
        break;
    }
  }

  if (headers.length === 0 && rows.length > 0) {
    headers = rows.shift(); // Assume first row is header if no thead
  }

  return headers.length ? { headers, rows, alignments: headers.map(() => 'left') } : null;
};

const drawTable = (pdf, table, x, y, width, styles) => {
  const { headers, alignments, rows } = table;
  const cellPadding = styles.table.cell.padding;
  const lineHeight = styles.table.cell.lineHeight;
  const colWidths = headers.map(() => width / headers.length);

  const getRowHeight = (cells) => {
    let maxHeight = 0;
    cells.forEach((cell, i) => {
      const wrappedText = pdf.splitTextToSize(cleanContent(cell), colWidths[i] - (cellPadding * 2));
      maxHeight = Math.max(maxHeight, wrappedText.length * lineHeight);
    });
    return maxHeight + (cellPadding * 2);
  };

  let currentY = y;
  pdf.setFillColor(styles.colors.tableHeaderBg);
  pdf.rect(x, currentY, width, getRowHeight(headers), 'F');
  headers.forEach((header, i) => {
    const cellX = x + colWidths.slice(0, i).reduce((sum, w) => sum + w, 0); // Calculate starting x for this cell
    const textX = alignments[i] === 'center' ? cellX + (colWidths[i] / 2) : alignments[i] === 'right' ? cellX + colWidths[i] - cellPadding : cellX + cellPadding;
    const textY = currentY + cellPadding;
    pdf.setTextColor(styles.colors.tableHeader);
    const wrappedText = pdf.splitTextToSize(cleanContent(header), colWidths[i] - (cellPadding * 2));
    wrappedText.forEach((line, j) => {
      pdf.text(line, textX, textY + (j * lineHeight), { align: alignments[i] });
    });
  });
  currentY += getRowHeight(headers);

  rows.forEach(row => {
    const rowHeight = getRowHeight(row);
    row.forEach((cell, i) => {
      const cellX = x + colWidths.slice(0, i).reduce((sum, w) => sum + w, 0); // Calculate starting x for this cell
      const textX = alignments[i] === 'center' ? cellX + (colWidths[i] / 2) : alignments[i] === 'right' ? cellX + colWidths[i] - cellPadding : cellX + cellPadding;
      const textY = currentY + cellPadding;
      pdf.setTextColor(styles.colors.text);
      const wrappedText = pdf.splitTextToSize(cleanContent(cell), colWidths[i] - (cellPadding * 2));
      wrappedText.forEach((line, j) => {
        pdf.text(line, textX, textY + (j * lineHeight), { align: alignments[i] });
      });
    });
    currentY += rowHeight;
  });

  pdf.setDrawColor(styles.colors.tableBorder);
  let gridX = x;
  colWidths.forEach(width => {
    pdf.line(gridX, y, gridX, currentY);
    gridX += width;
  });
  pdf.line(gridX, y, gridX, currentY);
  let gridY = y;
  [getRowHeight(headers), ...rows.map(getRowHeight)].forEach(height => {
    pdf.line(x, gridY, x + width, gridY);
    gridY += height;
  });
  pdf.line(x, gridY, x + width, gridY);

  return currentY - y;
};