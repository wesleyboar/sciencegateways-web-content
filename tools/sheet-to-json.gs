/**
 * Google Apps Script: export the active sheet as JSON.
 *
 * Paste into the spreadsheet's Extensions > Apps Script, save, reload the
 * spreadsheet. An "Export JSON" menu appears next to "Help".
 *
 * Output matches Aug_20rev_2026Conf_csvjson.txt: an array of objects, keys in
 * header-row order, every value a string, 2-space indent, trailing newline.
 */

// Existing JSON exports in the repo use a .txt extension, not .json.
var FILE_EXTENSION = '.txt';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Export JSON')
    .addItem('Download JSON…', 'downloadJson')
    .addToUi();
}

function downloadJson() {
  var out = buildJson();
  var html = HtmlService.createHtmlOutput(
      '<style>body{font:13px/1.5 Arial,sans-serif;margin:16px}' +
      'a.btn{display:inline-block;padding:8px 14px;background:#1a73e8;color:#fff;' +
      'border-radius:4px;text-decoration:none}</style>' +
      '<p>' + out.rowCount + ' rows from “' + escapeHtml(out.sheetName) + '”.</p>' +
      '<p><a class="btn" id="dl" download="' + escapeHtml(out.fileName) + '">Download ' +
      escapeHtml(out.fileName) + '</a></p>' +
      '<script>' +
      'var text=' + JSON.stringify(out.json) + ';' +
      'document.getElementById("dl").href=URL.createObjectURL(' +
      'new Blob([text],{type:"application/json"}));' +
      '</script>')
    .setWidth(460)
    .setHeight(180);
  SpreadsheetApp.getUi().showModalDialog(html, 'Export JSON');
}

/** Reads the active sheet and returns { json, fileName, sheetName, rowCount }. */
function buildJson() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();

  // Display values are exactly what a CSV download would contain, so dates,
  // times, and TRUE/FALSE come out in the sheet's own formatting.
  var values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    throw new Error('Sheet “' + sheet.getName() + '” needs a header row and at least one data row.');
  }

  var headers = values[0];
  var records = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (isBlankRow(row)) {
      continue;
    }
    var record = {};
    for (var c = 0; c < headers.length; c++) {
      var key = String(headers[c]).trim();
      if (key) {
        record[key] = row[c] == null ? '' : String(row[c]);
      }
    }
    records.push(record);
  }

  var base = spreadsheet.getName();
  if (spreadsheet.getSheets().length > 1) {
    base += '_' + sheet.getName();
  }

  return {
    json: JSON.stringify(records, null, 2) + '\n',
    fileName: base.replace(/[\/\\:*?"<>|]/g, '-') + FILE_EXTENSION,
    sheetName: sheet.getName(),
    rowCount: records.length
  };
}

function isBlankRow(row) {
  for (var i = 0; i < row.length; i++) {
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
