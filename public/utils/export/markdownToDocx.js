import { parseTable, cleanContent } from './markdownTableUtils.js';

const md = markdownit({ html: true, linkify: true, typographer: true, breaks: true });

const DEFAULT_STYLES = {
  document: { defaultFont: 'Calibri', defaultFontSize: 11, margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
  headings: { h1: { size: 24, spacing: { before: 240, after: 120 } }, h2: { size: 20, spacing: { before: 200, after: 100 } }, h3: { size: 16, spacing: { before: 160, after: 80 } } },
  tables: { cellPadding: 100, borders: { color: 'CCCCCC', size: 1 }, header: { backgroundColor: 'F5F5F5', bold: true, fontSize: 11 }, cell: { fontSize: 11 } },
  code: { font: 'Courier New', size: 10, backgroundColor: 'F8F8F8' }
};

export const markdownToDocx = async (markdown, options = {}) => {
  const styles = { ...DEFAULT_STYLES, ...options };
  
  // Preprocess markdown to remove code block markers
  const processedMarkdown = markdown.replace(/```(?:markdown|json|[a-z]*)\n([\s\S]*?)```/gi, '$1');
  const tokens = md.parse(processedMarkdown, {});
  const elements = [];

  let listLevel = 0;
  let currentList = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 'heading_open': {
        const level = parseInt(token.tag.slice(1));
        const style = styles.headings[`h${level}`];
        const nextToken = tokens[++i];
        if (nextToken.type === 'inline') {
          elements.push(new docx.Paragraph({
            children: processInlineContent(nextToken.content, styles),
            heading: docx.HeadingLevel[`HEADING_${level}`],
            spacing: style.spacing
          }));
        }
        break;
      }
      case 'paragraph_open': {
        const nextToken = tokens[++i];
        if (nextToken.type === 'inline') {
          elements.push(new docx.Paragraph({
            children: processInlineContent(nextToken.content, styles),
            spacing: { before: 120, after: 120 }
          }));
        }
        break;
      }
      case 'bullet_list_open': {
        listLevel++;
        currentList = { type: 'bullet', items: [] };
        break;
      }
      case 'ordered_list_open': {
        listLevel++;
        currentList = { type: 'ordered', items: [] };
        break;
      }
      case 'list_item_open': {
        if (currentList) { // Ensure currentList exists
          const nextToken = tokens[++i];
          if (nextToken.type === 'inline') currentList.items.push(nextToken.content);
        }
        break;
      }
      case 'bullet_list_close':
      case 'ordered_list_close': {
        if (currentList && currentList.items) { // Check for null and items
          currentList.items.forEach(item => {
            elements.push(new docx.Paragraph({
              children: processInlineContent(item, styles),
              bullet: currentList.type === 'bullet' ? { level: listLevel - 1 } : undefined,
              numbering: currentList.type === 'ordered' ? { reference: 'mainNumbering', level: listLevel - 1 } : undefined,
              indent: { left: 720 * listLevel, hanging: 360 }
            }));
          });
        }
        listLevel--;
        currentList = null;
        break;
      }
      case 'code_block':
      case 'fence': {
        const lines = token.content.split('\n');
        elements.push(new docx.Paragraph({
          children: lines.map((line, index) => [
            new docx.TextRun({ text: line, font: styles.code.font, size: styles.code.size * 2 }),
            ...(index < lines.length - 1 ? [new docx.TextRun({ break: 1 })] : [])
          ]).flat(),
          shading: { type: 'SOLID', color: styles.code.backgroundColor }
        }));
        break;
      }
      case 'table_open': {
        const tableData = parseTableFromTokens(tokens, i);
        if (tableData) {
          elements.push(createDocxTable(tableData, styles));
          while (i < tokens.length && tokens[i].type !== 'table_close') i++;
        }
        break;
      }
    }
  }

  const doc = new docx.Document({
    numbering: { config: [{ reference: 'mainNumbering', levels: Array(9).fill().map((_, i) => ({ level: i, format: 'decimal', text: `%${i + 1}.`, alignment: docx.AlignmentType.START, style: { paragraph: { indent: { left: (i + 1) * 720, hanging: 360 } } } })) }] },
    sections: [{ properties: { page: { margin: styles.document.margins } }, children: elements }]
  });

  return await docx.Packer.toBlob(doc);
};

const processInlineContent = (content, styles) => {
  const lines = content.split('\n');
  return lines.map((line, index) => {
    const tokens = md.parseInline(line, {});
    const runs = tokens[0]?.children?.map(token => {
      switch (token.type) {
        case 'text': return new docx.TextRun({ text: token.content, size: styles.document.defaultFontSize * 2 });
        case 'strong': return new docx.TextRun({ text: token.content, bold: true, size: styles.document.defaultFontSize * 2 });
        case 'em': return new docx.TextRun({ text: token.content, italics: true, size: styles.document.defaultFontSize * 2 });
        case 'code_inline': return new docx.TextRun({ text: token.content, font: styles.code.font, size: styles.code.size * 2 });
        default: return new docx.TextRun({ text: token.content || '', size: styles.document.defaultFontSize * 2 });
      }
    }) || [new docx.TextRun({ text: line, size: styles.document.defaultFontSize * 2 })];
    return index < lines.length - 1 ? [...runs, new docx.TextRun({ break: 1 })] : runs;
  }).flat();
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

const createDocxTable = (tableData, styles) => {
  return new docx.Table({
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    rows: [
      new docx.TableRow({
        tableHeader: true,
        children: tableData.headers.map(header => new docx.TableCell({
          children: [new docx.Paragraph({ children: processInlineContent(cleanContent(header), styles) })],
          margins: { top: styles.tables.cellPadding, bottom: styles.tables.cellPadding, left: styles.tables.cellPadding, right: styles.tables.cellPadding },
          shading: { fill: styles.tables.header.backgroundColor }
        }))
      }),
      ...tableData.rows.map(row => new docx.TableRow({
        children: row.map(cell => new docx.TableCell({
          children: [new docx.Paragraph({ children: processInlineContent(cleanContent(cell), styles) })],
          margins: { top: styles.tables.cellPadding, bottom: styles.tables.cellPadding, left: styles.tables.cellPadding, right: styles.tables.cellPadding }
        }))
      }))
    ],
    borders: { 
      top: { style: docx.BorderStyle.SINGLE, size: styles.tables.borders.size, color: styles.tables.borders.color }, 
      bottom: { style: docx.BorderStyle.SINGLE, size: styles.tables.borders.size, color: styles.tables.borders.color }, 
      left: { style: docx.BorderStyle.SINGLE, size: styles.tables.borders.size, color: styles.tables.borders.color }, 
      right: { style: docx.BorderStyle.SINGLE, size: styles.tables.borders.size, color: styles.tables.borders.color }, 
      insideHorizontal: { style: docx.BorderStyle.SINGLE, size: styles.tables.borders.size, color: styles.tables.borders.color }, 
      insideVertical: { style: docx.BorderStyle.SINGLE, size: styles.tables.borders.size, color: styles.tables.borders.color } 
    }
  });
};