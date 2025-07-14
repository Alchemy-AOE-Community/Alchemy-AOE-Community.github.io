async function loadPlayerLinks(sprint) {
    const file = `ALS${seasonNumber}_Resources/${sprint}/Registration.ods`;
    try {
        const response = await fetch(file);
        if (!response.ok) return {}; // Silent fail
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        let nameCol = -1, linkCol = 2; // Hardcode linkCol to column 3 (0-indexed: 2)
        // Scan header row 0 for name column
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cell = worksheet[XLSX.utils.encode_cell({r: 0, c: col})];
            const val = cell ? (cell.v || '').toLowerCase() : '';
            if (val.includes('player') || val.includes('name')) nameCol = col;
        }
        if (nameCol === -1) return {};
        const map = {};
        for (let row = 1; row <= range.e.r; row++) {
            const nameCell = worksheet[XLSX.utils.encode_cell({r: row, c: nameCol})];
            const linkCell = worksheet[XLSX.utils.encode_cell({r: row, c: linkCol})];
            if (nameCell && nameCell.v && linkCell && linkCell.v) {
                map[nameCell.v.trim()] = linkCell.v.trim();
            }
        }
        return map;
    } catch (error) {
        return {}; // Silent fail, no console.error
    }
}

async function loadODS(filePath, containerId, leftColumnLabel, headerRows = 2, skipRows = 0, maxRankDisplay = Infinity, playerMap = {}) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error('Failed to load ODS file');
    }
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const html = sheetToHtmlWithStyles(worksheet, leftColumnLabel, headerRows, skipRows, maxRankDisplay, playerMap);
    document.getElementById(containerId).innerHTML = '<div style="overflow-x: auto;">' + html + '</div>';
    autoSizeColumns(containerId);
  } catch (error) {
    console.error(error);
    document.getElementById(containerId).innerHTML = '<p style="padding:10px; text-align:center; margin:0;">Not Yet Calculated</p>';
  }
}


function sheetToHtmlWithStyles(worksheet, leftColumnLabel, headerRows, skipRows, maxRankDisplay, playerMap) {
  if (!worksheet || !worksheet['!ref']) return '<table></table>';
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const merges = worksheet['!merges'] || [];

  // Find the player name column by scanning headers
  let nameCol = -1;
  for (let hrow = 0; hrow < headerRows; hrow++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = worksheet[XLSX.utils.encode_cell({r: hrow, c: col})];
      const val = cell ? (cell.v || '').toLowerCase() : '';
      if (val.includes('player') || val.includes('name')) {
        nameCol = col;
        break;
      }
    }
    if (nameCol !== -1) break;
  }

  let html = '<table>';
  html += '<colgroup></colgroup>';

  let rank = 1;
  for (let row = range.s.r; row <= range.e.r; row++) {
    if (row >= headerRows && (row - headerRows) < skipRows) continue; // Skip specified data rows

    html += '<tr>';
    // Add left column
    if (row < headerRows) {
      if (row === 0) {
        const rowspanAttr = headerRows > 1 ? ' rowspan="2"' : '';
        html += `<td${rowspanAttr} style="background-color: #cccccc; text-align: center; white-space: normal; word-wrap: break-word;">${leftColumnLabel}</td>`;
      }
    } else {
      let displayRank = (rank > maxRankDisplay) ? '~' : rank;
      html += `<td style="text-align: center;">${displayRank}</td>`;
      rank++;
    }

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = { r: row, c: col };
      const cellRef = XLSX.utils.encode_cell(cellAddress);

      let isMerged = false;
      let colspan = 1;
      let rowspan = 1;
      for (const merge of merges) {
        if (row >= merge.s.r && row <= merge.e.r && col >= merge.s.c && col <= merge.e.c) {
          if (row === merge.s.r && col === merge.s.c) {
            colspan = merge.e.c - merge.s.c + 1;
            rowspan = merge.e.r - merge.s.r + 1;
          } else {
            isMerged = true;
            break;
          }
        }
      }
      if (isMerged) continue;

      const cell = worksheet[cellRef];
      let cellValue = cell ? XLSX.utils.format_cell(cell) : '';
      let style = '';
      if (cell && cell.s && cell.s.fill && cell.s.fill.fgColor && cell.s.fill.fgColor.rgb) {
        style = `background-color: #${cell.s.fill.fgColor.rgb};`;
      }

      // If this is a data row and the player name column, add hyperlink if available
      if (row >= headerRows && col === nameCol && cellValue) {
        const trimmedName = cellValue.trim();
        const link = playerMap[trimmedName];
        if (link) {
          cellValue = `<a href="${link}" target="_blank" style="text-decoration: underline; color: blue; background: none; border: none; padding: 0; margin: 0; cursor: pointer;">${cellValue}</a>`;
        }
        style += (style ? '; ' : '') + 'white-space: nowrap;';
      }

      const spanAttrs = (colspan > 1 ? ` colspan="${colspan}"` : '') + (rowspan > 1 ? ` rowspan="${rowspan}"` : '');
      html += `<td style="${style}"${spanAttrs}>${cellValue}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}

function autoSizeColumns(containerId) {
  const table = document.querySelector(`#${containerId} table`);
  if (!table) return;

  const rows = Array.from(table.rows);
  const numCols = Math.max(...rows.map(row => row.cells.length));
  const colWidths = new Array(numCols).fill(0);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  rows.forEach(row => {
    Array.from(row.cells).forEach((cell, colIndex) => {
      const text = cell.textContent.trim();
      const computedStyle = window.getComputedStyle(cell);
      ctx.font = `${computedStyle.fontStyle} ${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
      let width;
      if (['Seed Number', 'Rank'].includes(text)) {
        const words = text.split(' ');
        let maxWordWidth = 0;
        words.forEach(word => {
          const metrics = ctx.measureText(word);
          maxWordWidth = Math.max(maxWordWidth, metrics.width);
        });
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
        const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
        const extra = paddingLeft + paddingRight + borderLeft + borderRight + 10;
        width = maxWordWidth + extra;
      } else {
        const textMetrics = ctx.measureText(text);
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
        const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
        let extra = paddingLeft + paddingRight + borderLeft + borderRight + 10;
        if (cell.innerHTML.includes('<a ')) { // Add buffer for name columns
          extra += 20; // Additional buffer to prevent wrapping
        }
        width = textMetrics.width + extra;
      }

      if (cell.colSpan === 1) {
        colWidths[colIndex] = Math.max(colWidths[colIndex], width);
      } else {
        const avgWidth = width / cell.colSpan;
        for (let i = colIndex; i < colIndex + cell.colSpan; i++) {
          colWidths[i] = Math.max(colWidths[i] || 0, avgWidth);
        }
      }
    });
  });

  let colgroup = table.querySelector('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    table.insertBefore(colgroup, table.firstChild);
  }
  colgroup.innerHTML = '';
  colWidths.forEach(width => {
    const col = document.createElement('col');
    col.style.width = `${width}px`;
    colgroup.appendChild(col);
  });
}

async function initDataLoaders() {
  const playerLinksSprint1 = await loadPlayerLinks('Sprint1');
  const playerLinksSprint2 = await loadPlayerLinks('Sprint2');
  await loadODS(`ALS${seasonNumber}_Resources/Sprint1/Seeding_Full.ods`, 'spreadsheet-container', 'Seed Number', 2, 0, Infinity, playerLinksSprint1);
  await loadODS(`ALS${seasonNumber}_Resources/Sprint2/Seeding_Full.ods`, 'spreadsheet-container-sprint2', 'Seed Number', 2, 0, Infinity, playerLinksSprint2);
  await loadODS(`ALS${seasonNumber}_Resources/Sprint1/Results.ods`, 'results-container', 'Rank', 1, prizeIneligibles1, prizeWinners1, playerLinksSprint1);
  await loadODS(`ALS${seasonNumber}_Resources/Sprint2/Results.ods`, 'results-container-sprint2', 'Rank', 1, prizeIneligibles2, prizeWinners2, playerLinksSprint2);
  adjustBottomRowHeight();
}