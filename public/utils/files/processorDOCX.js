// utils/files/processorDOCX.js
const wordStyles = `
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; padding: 8px; }
    th { background-color: #f2f2f2; font-weight: bold; }
    .mammoth-shading { background-color: #e6e6e6; }
    .mammoth-table { border: 1px solid #000; }
    .mammoth-page-break { page-break-before: always; }
  </style>
`;

export async function processDOCX(arrayBuffer) {
  if (!arrayBuffer) throw new Error('Invalid DOCX input');

  const htmlResult = await mammoth.convertToHtml({
    arrayBuffer,
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

  const textResult = await mammoth.extractRawText({ arrayBuffer });
  const markdown = marked.parse(textResult.value); // Convert raw text to Markdown

  const html = `${wordStyles}<div class="document-content">${htmlResult.value}</div>`;
  const pagesHtml = [];
  let currentPageContent = '';
  htmlResult.value.split('<div class="mammoth-page-break">').forEach((section, index) => {
    if (index > 0) {
      pagesHtml.push(`${wordStyles}<div class="document-content">${currentPageContent}</div>`);
      currentPageContent = section;
    } else {
      currentPageContent = section;
    }
  });
  if (currentPageContent) pagesHtml.push(`${wordStyles}<div class="document-content">${currentPageContent}</div>`);

  return {
    pagesHtml,
    pagesText: [markdown], // Single Markdown page for simplicity; could split by sections if needed
  };
}