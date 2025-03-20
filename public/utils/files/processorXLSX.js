// utils/files/processorXLSX.js
export async function processXLSX(arrayBuffer, mimeType) {
    if (!arrayBuffer) throw new Error('Invalid XLSX/CSV input');
  
    const pagesText = [];
  
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
  
      workbook.eachSheet((worksheet) => {
        let headerRow = null;
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          if (!headerRow && row.values.some(val => val)) {
            headerRow = row;
          }
        });
  
        if (!headerRow) return;
  
        const headers = headerRow.values.slice(1); // Skip index 0 (empty due to 1-based indexing)
        const sheetData = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber <= headerRow.number) return;
          const rowData = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (colNumber - 1 < headers.length) {
              rowData[headers[colNumber - 1]] = cell.value;
            }
          });
          sheetData.push(rowData);
        });
        pagesText.push(JSON.stringify({ [worksheet.name]: sheetData }, null, 2));
      });
    } else if (mimeType === 'text/csv') {
      const text = new TextDecoder().decode(arrayBuffer);
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
      if (rows.length === 0) return { pagesText: [''] };
  
      const headers = rows[0];
      const sheetData = rows.slice(1).map(row => {
        const rowData = {};
        row.forEach((cell, i) => {
          if (i < headers.length) rowData[headers[i]] = cell;
        });
        return rowData;
      });
      pagesText.push(JSON.stringify({ Sheet1: sheetData }, null, 2));
    }
  
    return { pagesText };
  }