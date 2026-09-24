/**
 * Schedule JSON Builder — parses the EXISTING sheet layout directly
 * (session header rows + "#, Type, Title, Min" sub-tables), instead of
 * requiring a flat one-row-per-event schema.
 *
 * EXPECTED LAYOUT (same as your current sheet):
 *
 *   "Session 1: Platforms, Portals and Federation",,,,Accepted Poster/BYOP Offer?
 *   #,Type,Title,Authors,Min,Accepted Poster/BYOP Offer?,Abstract
 *   10,PAPER,"Building a Portal for the NAIRR Pilot Project","Jeanette Sperhac, ...",14,,"..."
 *   17,PAPER,"...","...",14,,"..."
 *   ...
 *   ,,,,80,                     <- totals row ends the session block
 *   (blank row)
 *   "Session 2: ...",,,,
 *   #,Type,Title,Authors,Min,Accepted Poster/BYOP Offer?,Abstract
 *   ...
 *
 * SESSION_CONFIG below supplies the date/start/end/moderator for each
 * session, since the sheet itself doesn't contain that. Edit this
 * block if session times, dates, or moderators change.
 *
 * TUTORIALS: this sheet format has no room for tutorials (different
 * shape entirely — dates, Zoom links, full descriptions). If a
 * separate tab named exactly "Tutorials" exists (flat schema: id,
 * date, session_start_time, ... same 17 columns as before), its rows
 * are merged in as-is. If that tab doesn't exist, tutorials are
 * skipped and a warning is shown.
 *
 * SETUP: same as before — Extensions > Apps Script, paste this in,
 * save, reload the sheet, use the new "Schedule" menu.
 */

/**
 * OUTPUT JSON FORMAT
 * ===================
 * The build produces a flat JSON array. Each element is one event
 * object (one talk, paper, tutorial, or other schedule item) with
 * exactly these fields:
 *
 *   id                 string  Unique identifier. Talks/papers get
 *                               "TALK" + the sheet's # column,
 *                               zero-padded to 3 digits (e.g. "TALK010"
 *                               for #10). Tutorial ids come as-is from
 *                               the "Tutorials" tab (e.g. "TUT001").
 *   date                string  Event date, "YYYY-MM-DD".
 *   session_start_time  string  Start of the whole session block this
 *                               event belongs to, e.g. "10:30 AM".
 *                               Same value on every event in a session.
 *   session_end_time    string  End of the whole session block, e.g.
 *                               "12:00 PM". Same value on every event
 *                               in a session.
 *   event_start_time    string  This specific event's own start time,
 *                               e.g. "10:30 AM". Computed by walking
 *                               forward from session_start_time using
 *                               each prior talk's Min duration — NOT
 *                               copied from the sheet (the sheet has
 *                               no per-talk time column).
 *   event_end_time      string  This specific event's own end time,
 *                               e.g. "10:44 AM". event_start_time +
 *                               the talk's Min value.
 *   timezone             string  IANA timezone, always
 *                               "America/New_York" (see TIMEZONE const
 *                               above).
 *   session_title        string  The full session header text, e.g.
 *                               "Session 1: Platforms, Portals and
 *                               Federation". Used by the page's JS to
 *                               group events under one header.
 *   title                 string  The talk/paper/tutorial title only
 *                               (the sheet's Title column).
 *   abstract              string  OPTIONAL — the sheet's Abstract column
 *                               for that row, if non-blank. Rendered as
 *                               a labeled "Abstract" field in the
 *                               expandable detail view on the page.
 *   type                   string  Lowercased event type: "paper",
 *                               "talk", or "tutorial". Drives the
 *                               filter dropdown and colored tag on the
 *                               live page.
 *   speakers               string  The sheet's Authors column, as-is.
 *   description             string  Rendered (with basic markdown —
 *                               **bold** and [text](url) links) in the
 *                               expandable detail view on the page.
 *                               For talks/papers this is currently just
 *                               "**Session Moderator:** Name,
 *                               Institution" — there's no per-talk
 *                               abstract data in this sheet. Tutorials
 *                               carry their own full description from
 *                               the "Tutorials" tab.
 *   location                 string  Room/venue. Always blank for
 *                               talks/papers here (not tracked in this
 *                               sheet); tutorials set it via the
 *                               "Tutorials" tab.
 *   format                    string  "In-person" for every talk/paper
 *                               produced by this script. Tutorials set
 *                               their own value (typically "Virtual")
 *                               via the "Tutorials" tab.
 *   registration_url           string  Always blank for talks/papers.
 *                               Tutorials may carry a Zoom link via the
 *                               "Tutorials" tab.
 *   visible                     string  Always "TRUE" for anything this
 *                               script outputs. The page's JS treats
 *                               any of "true"/"yes"/"1" (case-
 *                               insensitive) as visible and hides
 *                               anything else — an empty string is NOT
 *                               visible.
 *   expandable                   string  Always "TRUE" here, meaning
 *                               the event is clickable to reveal
 *                               description/location/format/timezone/
 *                               registration link in the UI.
 *   poster_or_byop_flag           string  OPTIONAL — only present when
 *                               the sheet's "Accepted Poster/BYOP
 *                               Offer?" column was non-blank for
 *                               that row, e.g. "Poster" or "BYOP". Not
 *                               read or displayed by the current page
 *                               JS; kept for traceability back to the
 *                               source sheet only.
 *
 * Field order in each object follows the order above. Tutorials pulled
 * from the "Tutorials" tab are prepended before talks/papers in the
 * output array (order doesn't matter to the page — it re-sorts
 * everything by date/session/time itself).
 */

const SESSION_CONFIG = {
  "Session 1: Platforms, Portals and Federation": {
    date: "2026-09-24", start: "10:30 AM", end: "12:00 PM",
    moderator: "Sabrina Perry, Austin Peay State University",
  },
  "Session 2: Data Foundations: FAIR, Governed, Shared, Verifiable": {
    date: "2026-09-24", start: "3:30 PM", end: "5:15 PM",
    moderator: "Sajida Faiyaz, Austin Community College",
  },
  "Session 3: AI Inside the Gateway: Agents, Assistants and Guardrails": {
    date: "2026-09-25", start: "10:30 AM", end: "12:00 PM",
    moderator: "Ahmad Al-Omari, Our Lady of the Lake University",
  },
  "Session 4: Readiness for the AI Age: Learning, Workforce and Community": {
    date: "2026-09-25", start: "3:00 PM", end: "4:30 PM",
    moderator: "Drew LaMar, College of William and Mary",
  },
};

const TIMEZONE = "America/New_York";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Output Schedule json")
    .addItem("Build JSON (preview / copy)", "buildJsonPreview")
    .addItem("Download JSON…", "buildJsonDownload")
    .addItem("Build JSON to Drive", "buildJsonToDrive")
    .addToUi();
}

// ---- time helpers ----

function parseTimeToMinutes_(t) {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) throw new Error("Bad time format: " + t);
  let h = Number(m[1]);
  const min = Number(m[2]);
  const period = m[3].toUpperCase();
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return h * 60 + min;
}

function minutesToTime_(totalMin) {
  let h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return h + ":" + String(min).padStart(2, "0") + " " + period;
}

// Some sheet cells display time-of-day as 24-hour "13:00" depending on
// that cell's number format, rather than "1:00 PM". The page displays
// whatever string is in the JSON verbatim, so normalize to "H:MM AM/PM"
// here for a consistent look regardless of how a given cell is formatted.
// Leaves already-correct "H:MM AM/PM" strings, and anything that doesn't
// look like a time at all (blank, malformed), untouched.
function normalizeTimeDisplay_(value) {
  const s = String(value || "").trim();
  if (!s) return s;
  const m = s.match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return s;
  if (m[3]) return s; // already has AM/PM
  let h = Number(m[1]);
  const min = Number(m[2]);
  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ":" + String(min).padStart(2, "0") + " " + period;
}

// ---- parse the existing session-block layout ----

function isSessionHeaderRow_(row) {
  const first = String(row[0] || "").trim();
  return /^Session\s+\d+:/i.test(first);
}

function isSubHeaderRow_(row) {
  return String(row[0] || "").trim() === "#" &&
    String(row[1] || "").trim().toUpperCase() === "TYPE";
}

function isTotalsRow_(row) {
  const first = String(row[0] || "").trim();
  const type = String(row[1] || "").trim();
  const title = String(row[2] || "").trim();
  const authors = String(row[3] || "").trim();
  const min = String(row[4] || "").trim();
  return first === "" && type === "" && title === "" && authors === "" && min !== "";
}

function isBlankRow_(row) {
  return row.every(c => String(c || "").trim() === "");
}

// Reads a cell's ACTUAL text content, resolving any hyperlink runs
// (including Sheets "smart chip" style URL rendering, which can show
// a truncated/preview label via getDisplayValues() while the real
// underlying URL is intact in the run's link target) to their real
// URL rather than whatever label happens to be displayed. Falls back
// to the run's own text for any non-link run, so normal plain text
// and mixed cells (plain text + an inline link) both come through
// correctly, in order.
function extractCellText_(richTextValue) {
  if (!richTextValue) return "";
  const runs = richTextValue.getRuns();
  if (!runs || runs.length === 0) {
    return richTextValue.getText() || "";
  }
  let result = "";
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const linkUrl = run.getLinkUrl();
    result += linkUrl ? linkUrl : run.getText();
  }
  return result;
}

// Reads a full sheet range as plain strings, defaulting to
// getDisplayValues() (correct for numbers, dates, and plain text —
// see the date/time bug this originally fixed), but overriding any
// individual cell that contains a hyperlink run with its REAL link
// target via extractCellText_, instead of whatever truncated/preview
// label that cell might display (the smart-chip/URL truncation bug).
// Cells with no link run are left as their plain display value.
function getResolvedTextGrid_(sheet) {
  const range = sheet.getDataRange();
  const displayValues = range.getDisplayValues();
  const richValues = range.getRichTextValues();

  return displayValues.map((row, r) =>
    row.map((displayVal, c) => {
      const rich = richValues[r][c];
      if (rich) {
        const runs = rich.getRuns();
        const hasLink = runs && runs.some(run => run.getLinkUrl());
        if (hasLink) {
          return extractCellText_(rich);
        }
      }
      return displayVal;
    })
  );
}

// Registration URLs are stored in the sheet WITHOUT the "https://"
// prefix on purpose (e.g. "ucsd.zoom.us/meeting/register/abc123") so
// Sheets never auto-detects them as links and converts them into a
// hyperlink/smart-chip cell — which was truncating the value on
// display. This adds "https://" back on the way into the JSON output.
// Leaves an already-prefixed value (http:// or https://) untouched,
// and leaves a blank value blank.
function ensureHttpsPrefix_(value) {
  const s = String(value || "").trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "https://" + s;
}

// Strips invisible/non-standard characters that sometimes survive a
// copy-paste from Word/Google Docs into a sheet cell — they look like
// normal text or ordinary line breaks but aren't, and can produce
// exactly the "unterminated string, newline reached" error some
// strict JSON validators show even though JSON.stringify escaped them
// correctly. Genuine, intentional line breaks (a real \n from
// Alt+Enter in a cell, used for multi-paragraph descriptions) are
// preserved — only converted from \r\n/\r to plain \n. Everything
// else non-standard is either normalized to a space (line/paragraph
// separators, vertical tab, form feed, NEL) or removed outright
// (zero-width characters, other C0 control codes).
function sanitizeText_(value) {
  if (!value) return value;
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u2028\u2029\u000B\u000C\u0085]/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[\u0000-\u0008\u000E-\u001F]/g, "");
}

// Name of the tab holding the session-block talks/papers data (the
// "#, Type, Title, Authors, Min" layout). Only used when EXPORT_ALL_TABS
// is false below.
const TALKS_SHEET_NAME = "Talks";

// When true (default), every tab in the spreadsheet is scanned for the
// "Session N:" layout (except "Tutorials", which has its own flat
// schema and is parsed separately by parseTutorialsTab_ below) — so
// talks/papers split across multiple tabs are all picked up. Set to
// false to restore the original single-tab behavior driven by
// TALKS_SHEET_NAME (with its active-tab fallback).
const EXPORT_ALL_TABS = true;

function getTalksSheets_(warnings) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (EXPORT_ALL_TABS) {
    return ss.getSheets().filter(s => s.getName() !== "Tutorials");
  }
  let sheet = ss.getSheetByName(TALKS_SHEET_NAME);
  if (!sheet) {
    // Fall back to whichever tab is active, so this still works if
    // TALKS_SHEET_NAME doesn't match — but warn, since silently
    // parsing the wrong tab is exactly the bug this replaces.
    sheet = SpreadsheetApp.getActiveSheet();
    warnings.push(
      'No tab named "' + TALKS_SHEET_NAME + '" found — read talks from the ' +
      'currently active tab ("' + sheet.getName() + '") instead. If that\'s ' +
      'not the right tab, either rename it to "' + TALKS_SHEET_NAME + '" or ' +
      "update TALKS_SHEET_NAME at the top of the script."
    );
  }
  return [sheet];
}

function parseTalksFromActiveSheet_(warnings) {
  const sheets = getTalksSheets_(warnings);
  const events = [];

  sheets.forEach(sheet => {
    // Resolved text (rich-text/link-aware), not display values — see
    // extractCellText_ / getResolvedTextGrid_ above. This avoids both
    // the Date-object timezone bug and the chip/hyperlink truncation
    // bug in one pass.
    const values = getResolvedTextGrid_(sheet);
    let i = 0;

    while (i < values.length) {
      const row = values[i];

      if (isSessionHeaderRow_(row)) {
        const sessionTitle = String(row[0]).trim();
        const config = SESSION_CONFIG[sessionTitle];
        if (!config) {
          warnings.push('No SESSION_CONFIG entry for "' + sessionTitle + '" — skipping this block. Add it to SESSION_CONFIG in the script.');
          i++;
          continue;
        }

        i++; // move to sub-header row
        if (i >= values.length || !isSubHeaderRow_(values[i])) {
          warnings.push('Expected "#, Type, Title, Min" header row right after "' + sessionTitle + '" but did not find it.');
          continue;
        }
        i++; // move to first data row

        let cursorMin = parseTimeToMinutes_(config.start);

        while (i < values.length && !isTotalsRow_(values[i]) && !isBlankRow_(values[i])) {
          const dataRow = values[i];
          const num = String(dataRow[0] || "").trim();
          const type = String(dataRow[1] || "").trim();
          const title = String(dataRow[2] || "").trim();
          const speakers = String(dataRow[3] || "").trim();
          const mins = Number(dataRow[4]);
          const extra = String(dataRow[5] || "").trim(); // Poster/BYOP flag
          const abstract = String(dataRow[6] || "").trim();

          if (!title) {
            i++;
            continue;
          }

          let eventStartTime = "";
          let eventEndTime = "";
          if (mins) {
            const startMin = cursorMin;
            const endMin = cursorMin + mins;
            cursorMin = endMin;
            eventStartTime = minutesToTime_(startMin);
            eventEndTime = minutesToTime_(endMin);
          }

          let description = "**Session Moderator:** " + config.moderator;

          events.push({
            id: num ? "TALK" + String(num).padStart(3, "0") : "TALK-R" + (i + 1),
            date: config.date,
            session_start_time: config.start,
            session_end_time: config.end,
            event_start_time: eventStartTime,
            event_end_time: eventEndTime,
            timezone: TIMEZONE,
            session_title: sessionTitle,
            title: title,
            type: type.toLowerCase(),
            speakers: speakers,
            description: description,
            location: "",
            format: "In-person",
            registration_url: "",
            visible: "TRUE",
            expandable: "TRUE",
          });

          if (extra) {
            events[events.length - 1].poster_or_byop_flag = extra;
          }

          if (abstract) {
            events[events.length - 1].abstract = abstract;
          }

          const built = events[events.length - 1];
          Object.keys(built).forEach(k => {
            if (typeof built[k] === "string") built[k] = sanitizeText_(built[k]);
          });

          i++;
        }

        const sessionWindowMin = parseTimeToMinutes_(config.end) - parseTimeToMinutes_(config.start);
        const usedMin = cursorMin - parseTimeToMinutes_(config.start);
        if (usedMin > sessionWindowMin) {
          warnings.push('"' + sessionTitle + '": talks total ' + usedMin + ' min but session window is only ' + sessionWindowMin + ' min (over by ' + (usedMin - sessionWindowMin) + ').');
        }

        // skip totals row + any trailing blank row
        if (i < values.length && isTotalsRow_(values[i])) i++;
        continue;
      }

      i++;
    }
  });

  return events;
}

// ---- tutorials from a separate "Tutorials" tab, if present ----

const FLAT_FIELDS = [
  "id", "date", "session_start_time", "session_end_time",
  "event_start_time", "event_end_time", "timezone", "session_title",
  "title", "type", "speakers", "description", "location", "format",
  "registration_url", "visible", "expandable",
];

function parseTutorialsTab_(warnings) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Tutorials");
  if (!sheet) {
    warnings.push('No "Tutorials" tab found — tutorials were not included in the output.');
    return [];
  }

  // getDisplayValues() returns exactly what's shown in each cell, as
  // plain text — no Date objects, no timezone conversion. But it can
  // also return a truncated/preview label for hyperlink or "smart
  // chip" style cells (e.g. registration_url links pasted as rich
  // links), which is why this uses getResolvedTextGrid_ instead:
  // it reads the real underlying link target for any link run,
  // falling back to plain text otherwise. See extractCellText_ above.
  const values = getResolvedTextGrid_(sheet);
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const missing = FLAT_FIELDS.filter(f => headers.indexOf(f) === -1);
  if (missing.length) {
    warnings.push('"Tutorials" tab is missing column(s): ' + missing.join(", ") + " — tutorials were not included.");
    return [];
  }

  const colIndex = {};
  FLAT_FIELDS.forEach(f => { colIndex[f] = headers.indexOf(f); });

  const events = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.every(c => String(c || "").trim() === "")) continue;
    const event = {};
    FLAT_FIELDS.forEach(f => {
      event[f] = String(row[colIndex[f]] || "").trim();
    });
    const TIME_FIELDS = ["session_start_time", "session_end_time", "event_start_time", "event_end_time"];
    TIME_FIELDS.forEach(f => { event[f] = normalizeTimeDisplay_(event[f]); });
    event.registration_url = ensureHttpsPrefix_(event.registration_url);
    FLAT_FIELDS.forEach(f => { event[f] = sanitizeText_(event[f]); });
    if (event.date && !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
      warnings.push('Tutorials tab, id=' + event.id + ': date "' + event.date + '" is not in YYYY-MM-DD format. Check the cell\'s format (Format > Number > Plain text, or re-enter as plain text) so it displays exactly as YYYY-MM-DD.');
    }
    const abstractCol = headers.indexOf("abstract");
    if (abstractCol !== -1) {
      const abstract = sanitizeText_(String(row[abstractCol] || "").trim());
      if (abstract) event.abstract = abstract;
    }
    event.visible = /^(true|yes|1)$/i.test(event.visible) ? "TRUE" : "FALSE";
    event.expandable = /^(true|yes|1)$/i.test(event.expandable) ? "TRUE" : "FALSE";
    events.push(event);
  }
  return events;
}

// ---- top-level build + menu actions ----

function buildAll_() {
  const warnings = [];
  const talks = parseTalksFromActiveSheet_(warnings);
  const tutorials = parseTutorialsTab_(warnings);
  return { events: tutorials.concat(talks), warnings: warnings };
}

// Parses the JSON the script itself just built. If that fails, it means
// there's a genuinely invalid character in the underlying sheet data
// (not a copy/paste artifact from later steps) — and pinpoints exactly
// where, with character codes, so it can be found and fixed at the
// source cell instead of guessed at.
function validateJson_(json) {
  try {
    JSON.parse(json);
    return null; // valid
  } catch (e) {
    const msg = String(e.message || e);
    const posMatch = msg.match(/position (\d+)/i);
    if (!posMatch) {
      return "JSON.parse failed but couldn't extract a position from: " + msg;
    }
    const pos = Number(posMatch[1]);
    const start = Math.max(0, pos - 40);
    const end = Math.min(json.length, pos + 10);
    const context = json.slice(start, end);

    const chars = [];
    for (let i = Math.max(0, pos - 3); i < Math.min(json.length, pos + 3); i++) {
      const ch = json[i];
      const code = json.charCodeAt(i);
      chars.push(
        (i === pos ? ">>> " : "    ") +
        "index " + i + ": code " + code +
        " (0x" + code.toString(16).padStart(4, "0") + ")" +
        (code >= 32 && code < 127 ? " '" + ch + "'" : " [non-printable]")
      );
    }

    return (
      "JSON.parse failed: " + msg + "\n\n" +
      "Context around position " + pos + ":\n" +
      '..."' + context.replace(/\n/g, "\\n") + '"...\n\n' +
      "Character codes around the failure point:\n" +
      chars.join("\n")
    );
  }
}

function buildJsonPreview() {
  const ui = SpreadsheetApp.getUi();
  const result = buildAll_();
  const json = JSON.stringify(result.events, null, 2);

  const validationError = validateJson_(json);
  if (validationError) {
    ui.alert("JSON self-check failed", validationError, ui.ButtonSet.OK);
    return;
  }
  

  let message = "Built " + result.events.length + " events. Self-check passed (valid JSON).";
  if (result.warnings.length) {
    message += "\n\nWARNINGS:\n" + result.warnings.join("\n");
  }

  const html = HtmlService.createHtmlOutput(
    "<p>" + message.replace(/\n/g, "<br>") + "</p>" +
    "<textarea style='width:100%;height:350px;'>" +
    json.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
    "</textarea>"
  ).setWidth(600).setHeight(500);


  ui.showModalDialog(html, "Schedule JSON");
}

// Client-side download, same pattern as json-output-from-tacc.gs's
// downloadJson(): builds a Blob URL in the browser, so no DriveApp
// scope is needed (unlike buildJsonToDrive below).
function buildJsonDownload() {
  const ui = SpreadsheetApp.getUi();
  const result = buildAll_();
  const json = JSON.stringify(result.events, null, 2);

  const validationError = validateJson_(json);
  if (validationError) {
    ui.alert("JSON self-check failed", validationError, ui.ButtonSet.OK);
    return;
  }

  const filename = "2026_CONFERENCE_SCHEDULE.json";
  let message = "Built " + result.events.length + " events. Self-check passed (valid JSON).";
  if (result.warnings.length) {
    message += "\n\nWARNINGS:\n" + result.warnings.join("\n");
  }

  const html = HtmlService.createHtmlOutput(`
      <style>
        body { font: 13px/1.5 Arial, sans-serif; margin: 16px }
        a.btn {
          display: inline-block; padding: 8px 14px;
          background: #1a73e8; color: #fff;
          border-radius: 4px; text-decoration: none;
        }
      </style>
      <p>${message.replace(/\n/g, "<br>")}</p>
      <p>
        <a class="btn" id="dl" download="${filename}"
          >Download ${filename}</a>
      </p>
      <script>
        const text = ${JSON.stringify(json)};
        document.getElementById('dl').href = URL.createObjectURL(
          new Blob([text], { type: 'application/json' }));
      </script>
    `)
    .setWidth(460)
    .setHeight(220);

  ui.showModalDialog(html, "Download Schedule JSON");
}

function buildJsonToDrive() {
  const ui = SpreadsheetApp.getUi();
  const result = buildAll_();
  const json = JSON.stringify(result.events, null, 2);

  const validationError = validateJson_(json);
  if (validationError) {
    ui.alert("JSON self-check failed — not saved", validationError, ui.ButtonSet.OK);
    return;
  }

  const filename = "2026_CONFERENCE_SCHEDULE.json";

  const existing = DriveApp.getFilesByName(filename);
  let file;
  if (existing.hasNext()) {
    file = existing.next();
    file.setContent(json);
  } else {
    file = DriveApp.createFile(filename, json, MimeType.PLAIN_TEXT);
  }

  let message = "Saved " + result.events.length + " events to Drive file: " + filename + "\nSelf-check passed (valid JSON).";
  if (result.warnings.length) {
    message += "\n\nWARNINGS:\n" + result.warnings.join("\n");
  }


  ui.alert("Build complete", message, ui.ButtonSet.OK);
}
