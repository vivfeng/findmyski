/**
 * FindMySki — Google Apps Script
 *
 * This script receives ski recommendation data from the FindMySki website,
 * logs it to a Google Sheet, and emails the recommendation to the user.
 *
 * SETUP:
 * 1. Open https://script.google.com and create a new project
 * 2. Paste this entire file into Code.gs (replace any default content)
 * 3. Click Deploy → New deployment
 * 4. Select type: "Web app"
 * 5. Set "Execute as": Me
 * 6. Set "Who has access": Anyone
 * 7. Click Deploy and copy the Web app URL
 * 8. In your Vercel project settings, add environment variable:
 *    APPS_SCRIPT_URL = <the web app URL you copied>
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
    if (data.email && data.htmlBody) {
      MailApp.sendEmail({
        to: data.email,
        subject: "Your Ski Recommendation — " + (data.brand || "") + " " + (data.model || ""),
        htmlBody: data.htmlBody,
        name: "FindMySki",
      });
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok" })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Required for CORS preflight (not typically needed for server-to-server calls,
// but included for completeness)
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok", message: "FindMySki API is running." })
  ).setMimeType(ContentService.MimeType.JSON);
}
