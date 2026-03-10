/**
 * FindMySki — Google Apps Script
 *
 * This script receives ski recommendation data from the FindMySki website,
 * logs it to a Google Sheet, and emails the recommendation to the user.
 *
 * SETUP:
 * 1. Open https://script.google.com and create a new project
 * 2. Paste this entire file into Code.gs (replace any default content)
 * 3. Update appsscript.json with the required OAuth scopes (see below)
 * 4. Click Deploy → New deployment
 * 5. Select type: "Web app"
 * 6. Set "Execute as": Me
 * 7. Set "Who has access": Anyone
 * 8. Click Deploy and copy the Web app URL
 * 9. In your Vercel project settings, add environment variable:
 *    APPS_SCRIPT_URL = <the web app URL you copied>
 *
 * REQUIRED appsscript.json:
 * {
 *   "timeZone": "America/Los_Angeles",
 *   "dependencies": {},
 *   "exceptionLogging": "STACKDRIVER",
 *   "runtimeVersion": "V8",
 *   "oauthScopes": [
 *     "https://www.googleapis.com/auth/spreadsheets",
 *     "https://www.googleapis.com/auth/gmail.send"
 *   ]
 * }
 *
 * SPREADSHEET: https://docs.google.com/spreadsheets/d/18xWVCkxTStXdz6IZPAwhecSAOxdd1ao1RoUzFKumz8w/edit
 */

var SPREADSHEET_ID = "18xWVCkxTStXdz6IZPAwhecSAOxdd1ao1RoUzFKumz8w";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ── Write to Google Sheet ──────────────────────────────────────────────
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheets()[0]; // first sheet

    // Add header row if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Email",
        "Brand",
        "Model",
        "Length",
        "Waist",
        "Flex",
        "Price Range",
        "Headline",
        "Priority",
        "Level",
      ]);
    }

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.email || "",
      data.brand || "",
      data.model || "",
      data.length || "",
      data.waist || "",
      data.flex || "",
      data.priceRange || "",
      data.headline || "",
      data.priority || "",
      data.level || "",
    ]);

    // ── Send email with recommendation ─────────────────────────────────────
    var emailSent = false;
    if (data.email && data.htmlBody) {
      try {
        GmailApp.sendEmail(
          data.email,
          "Your Ski Recommendation — " + (data.brand || "") + " " + (data.model || ""),
          "Your ski recommendation is attached as HTML.",
          { htmlBody: data.htmlBody, name: "FindMySki" }
        );
        emailSent = true;
      } catch (mailErr) {
        // Email failed but sheet write succeeded — still return ok
      }
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok", emailSent: emailSent })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok", message: "FindMySki API is running." })
  ).setMimeType(ContentService.MimeType.JSON);
}
