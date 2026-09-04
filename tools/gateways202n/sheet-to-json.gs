/**
 * To export the active sheet as JSON.
 *
 * Execute on a given spreadsheet via the Google Sheet menu:
 *       Export JSON
 * (to the right of Help)
 */

const FILE_EXTENSION = '.json';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Export JSON')
    .addItem('Download JSON…', 'downloadJson')
    .addToUi();
}

function downloadJson() {
  const out = buildJson();
  const html = HtmlService.createHtmlOutput(`
      <style>
        body { font: 13px/1.5 Arial, sans-serif; margin: 16px }
        a.btn {
          display: inline-block; padding: 8px 14px;
          background: #1a73e8; color: #fff;
          border-radius: 4px; text-decoration: none;
        }
      </style>
      <p>${out.rowCount} rows from “${escapeHtml(out.sheetName)}”.</p>
      <p>
        <a class="btn" id="dl" download="${escapeHtml(out.fileName)}"
          >Download ${escapeHtml(out.fileName)}</a>
      </p>
      <script>
        const text = ${JSON.stringify(out.json)};
        document.getElementById('dl').href = URL.createObjectURL(
          new Blob([text], { type: 'application/json' }));
      </script>
    `)
    .setWidth(460)
    .setHeight(180);

  SpreadsheetApp.getUi().showModalDialog(html, 'Export JSON');
}

/** Reads the active sheet and returns { json, fileName, sheetName, rowCount }. */
function buildJson() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();

  // Display values are exactly what a CSV download would contain, so dates,
  // times, and TRUE/FALSE come out in the sheet's own formatting.
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    throw new Error('Sheet “' + sheet.getName() + '” needs a header row and at least one data row.');
  }

  const headers = values[0];
  const records = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (isBlankRow(row)) {
      continue;
    }
    const record = {};
    for (let c = 0; c < headers.length; c++) {
      const key = String(headers[c]).trim();
      if (key) {
        record[key] = row[c] == null ? '' : String(row[c]);
      }
    }
    records.push(record);
  }

  let base = spreadsheet.getName();
  if (spreadsheet.getSheets().length > 1) {
    base += '_' + sheet.getName();
  }
  // Date of export, in the spreadsheet's own time zone, e.g. "Sep 03".
  base += ' ' + Utilities.formatDate(
    new Date(), spreadsheet.getSpreadsheetTimeZone(), 'MMM dd');

  return {
    json: JSON.stringify(records, null, 2) + '\n',
    fileName: base.replace(/[\/\\:*?"<>|]/g, '-') + FILE_EXTENSION,
    sheetName: sheet.getName(),
    rowCount: records.length
  };
}

function isBlankRow(row) {
  for (let i = 0; i < row.length; i++) {
    if (String(row[i]).trim() !== '') {
      return false;
    }
  }
  return true;
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
