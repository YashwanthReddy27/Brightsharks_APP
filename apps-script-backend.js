// ============================================================
// BrightSharks v2 — Google Apps Script (EMAIL SERVICE)
//
// As of the Vercel Postgres migration, this script no longer owns
// any data. The Vercel API (/api on the Vercel deployment) is the
// source of truth for Users / Profiles / Weekly / Monthly.
//
// This script's only jobs are:
//   1. Send transactional emails on behalf of the Vercel API
//      (invite, support request, 4th-week milestone, H-1B expiry)
//   2. Run the scheduled reminders (Thursday/Friday/Monday for
//      STEM; H-1B monthly cycle), pulling data from the Vercel API.
//
// The `dumpAll` action is retained so the spreadsheet can be
// re-exported if a fresh re-import is ever needed.
//
// Deploy: Extensions → Apps Script → Deploy as Web App
//         Execute as: Me | Who has access: Anyone
// ============================================================

// ── Legacy sheet (kept only for one-shot dumps / fallback) ──
const SPREADSHEET_ID = "1LactsFRwfmDu_u7D_u1Wm3hFRgUQiC92iWGxXCPohlU";

// ── Where the new data lives (set after the Vercel deploy URL is known) ──
const VERCEL_API_URL = "https://brightsharks-app.vercel.app/api";
const APP_URL        = "https://brightsharks-app.vercel.app/";

// ── Email recipients ──
const HR_EMAIL = "yashwanthreddyvutukori45@gmail.com";

const SHEETS = {
  USERS:    "Users",
  PROFILES: "Profiles",
  WEEKLY:   "Weekly",
  MONTHLY:  "Monthly",
};

// ============================================================
// WEB APP ENTRY POINTS
// ============================================================
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result  = route(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, message: "BrightSharks email service running." }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ROUTER — email-only + one-shot dump
// ============================================================
function route(p) {
  switch (p.action) {
    // Called server-side by the Vercel API
    case "sendInviteEmail":        return sendInviteEmail(p.data);
    case "sendSupportEmail":       return sendSupportEmail(p.data);
    case "sendFourthWeekEmail":    return sendFourthWeekEmail(p.data, p.count);
    case "checkH1BExpiryForUser":  return checkH1BExpiry(p.userId, p.data);

    // One-shot migration helper
    case "dumpAll":                return dumpAll();

    default:
      return { success: false, error: "Unknown action: " + p.action };
  }
}

// ============================================================
// ONE-SHOT DUMP — export every sheet as JSON for migration
// ============================================================
function dumpAll() {
  const dump = {};
  Object.values(SHEETS).forEach(sheetName => {
    const values = getSheet(sheetName).getDataRange().getValues();
    if (values.length === 0) {
      dump[sheetName] = { headers: [], rows: [] };
      return;
    }
    const headers = values[0];
    const rows = values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let v = row[i];
        if (v instanceof Date) v = v.toISOString();
        obj[h] = v;
      });
      return obj;
    });
    dump[sheetName] = { headers, rows };
  });
  return { success: true, exportedAt: new Date().toISOString(), data: dump };
}

// ============================================================
// EMAIL ACTIONS — invoked by Vercel API
// ============================================================

function sendInviteEmail(data) {
  const visaLabel = data.visaType === "STEM_OPT" ? "STEM OPT"
                  : data.visaType === "H1B"      ? "H-1B"
                  : data.visaType || "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
      <div style="background:#0c0d10;padding:28px 32px;border-radius:10px 10px 0 0">
        <h1 style="color:#6c8fff;margin:0;font-size:1.6rem;letter-spacing:-0.5px">BrightSharks</h1>
        <p style="color:#888;margin:6px 0 0;font-size:13px">You've been invited to the team portal</p>
      </div>
      <div style="background:#f9f9f9;padding:28px 32px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px">
        <p style="font-size:15px">Hi <strong>${data.name}</strong>,</p>
        <p>${data.invitedBy || "Your manager"} has added you to <strong>BrightSharks</strong> — your compliance and evaluation portal.</p>

        <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:24px 0">
          <p style="margin:0 0 12px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;color:#888">Your Login Details</p>
          <p style="margin:0 0 8px"><strong>Portal:</strong> <a href="${APP_URL}" style="color:#6c8fff">${APP_URL}</a></p>
          <p style="margin:0 0 8px"><strong>Email:</strong> ${data.email}</p>
          <p style="margin:0 0 8px"><strong>Password:</strong> <code style="background:#f0f0f0;padding:2px 8px;border-radius:4px;font-size:14px">${data.password}</code></p>
          ${visaLabel ? `<p style="margin:8px 0 0"><strong>Visa Type:</strong> ${visaLabel}</p>` : ""}
        </div>

        <p><strong>Next steps:</strong></p>
        <ol style="padding-left:20px;line-height:2">
          <li>Log in using the credentials above</li>
          <li>Complete your profile (visa dates, I-983 form if STEM OPT)</li>
          <li>Submit your first evaluation when due</li>
        </ol>

        <p style="color:#888;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">
          Please keep your login credentials safe. If you have any issues logging in, contact your manager.
        </p>
      </div>
    </div>`;

  try {
    MailApp.sendEmail({ to: data.email, subject: "Welcome to BrightSharks — Your Login Details", htmlBody: html });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function sendSupportEmail(data) {
  const managers = getManagerEmailsForEmployee(data.employeeId);
  if (!managers.length) return { success: true, warning: "No managers found." };

  const subject = `🆘 Support Request: ${data.employeeName}`;
  const body = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
      <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#e8c97e;margin:0">BrightSharks</h2>
        <p style="color:#aaa;margin:4px 0 0;font-size:13px">Support Request</p>
      </div>
      <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
        <p><strong>${data.employeeName}</strong> has indicated they need support.</p>
        <p><strong>Period:</strong> ${data.week || data.month}</p>
        <p><strong>Message:</strong> ${data.supportMessage || "No details provided."}</p>
        <p style="color:#888;font-size:12px;margin-top:20px">Please follow up with them at your earliest convenience.</p>
      </div>
    </div>`;
  managers.forEach(email => {
    try { MailApp.sendEmail({ to: email, subject, htmlBody: body }); } catch (e) {}
  });
  return { success: true };
}

function sendFourthWeekEmail(data, count) {
  const managers = getManagerEmailsForEmployee(data.employeeId);
  if (!managers.length) return { success: true, warning: "No managers found." };

  const subject = `📊 4-Week Evaluation Complete: ${data.employeeName}`;
  const body = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
      <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#6c8fff;margin:0">BrightSharks</h2>
        <p style="color:#aaa;margin:4px 0 0;font-size:13px">STEM OPT — 4-Week Milestone</p>
      </div>
      <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
        <p><strong>${data.employeeName}</strong> has completed their <strong>${count}th weekly evaluation</strong> (every 4th week milestone).</p>
        <p>Please log in to BrightSharks to review and approve their 4-week period evaluations.</p>
      </div>
    </div>`;
  managers.forEach(email => {
    try { MailApp.sendEmail({ to: email, subject, htmlBody: body }); } catch (e) {}
  });
  return { success: true };
}

function checkH1BExpiry(userId, data) {
  if (!data || !data.h1bExpiry) return { success: true };
  const expiry   = new Date(data.h1bExpiry);
  const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft !== 180) return { success: true, skipped: true, daysLeft };

  const managers = getManagerEmails();
  const subject  = `⚠️ H-1B Expiry Alert: ${data.clientName || "Employee"} — 6 months remaining`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
      <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#ffbe3d;margin:0">BrightSharks — H-1B Expiry Alert</h2>
      </div>
      <div style="background:#fff8ec;padding:24px 28px;border:1px solid #f0d080;border-top:none;border-radius:0 0 8px 8px">
        <p>⚠️ <strong>${(data.i983 && data.i983.studentName) || "An employee"}</strong>'s H-1B visa expires in <strong>6 months (${data.h1bExpiry})</strong>.</p>
        <p>Please begin the renewal or transfer process immediately to avoid status gaps.</p>
        <p><strong>LCA Job Duties on file:</strong> ${data.lcaJobDuties || "Not provided"}</p>
      </div>
    </div>`;
  managers.forEach(email => {
    try { MailApp.sendEmail({ to: email, subject, htmlBody: html }); } catch (e) {}
  });
  try { MailApp.sendEmail({ to: HR_EMAIL, subject, htmlBody: html }); } catch (e) {}
  return { success: true };
}

// ============================================================
// VERCEL API CLIENT — used by scheduled reminders
// ============================================================
function vercelGet(action, extra) {
  const payload = Object.assign({ action }, extra || {});
  const res = UrlFetchApp.fetch(VERCEL_API_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  try {
    return JSON.parse(res.getContentText());
  } catch (e) {
    return { success: false, error: "Bad response: " + res.getContentText().slice(0, 200) };
  }
}

function fetchAllEmployees() {
  const r = vercelGet("getAllEmployees");
  return r.success ? r.data : [];
}

function fetchWeekly(employeeId) {
  const r = vercelGet("getWeekly", { employeeId });
  return r.success ? r.data : [];
}

function fetchMonthly(employeeId) {
  const r = vercelGet("getMonthly", { employeeId });
  return r.success ? r.data : [];
}

function fetchManagers() {
  const r = vercelGet("getManagers");
  return r.success ? r.data : [];
}

function getManagerEmails() {
  return fetchManagers().map(m => m.email).filter(Boolean);
}

function getManagerEmailsForEmployee(employeeId) {
  // If the employee's profile names a specific BrightSharks manager email, use it.
  const r = vercelGet("getProfile", { userId: employeeId });
  if (r && r.success && r.data && r.data.brightsharksManagerEmail) {
    return [r.data.brightsharksManagerEmail];
  }
  return getManagerEmails();
}

function getStemEmployees() {
  return fetchAllEmployees().filter(e =>
    e.visaType === "STEM_OPT" || (e.profile && e.profile.visaType === "STEM_OPT")
  );
}

function getH1BEmployees() {
  return fetchAllEmployees().filter(e =>
    e.visaType === "H1B" || (e.profile && e.profile.visaType === "H1B")
  );
}

function hasSubmittedWeekly(employeeId, week) {
  return fetchWeekly(employeeId).some(r => r.week === week);
}

function hasSubmittedMonthly(employeeId, month) {
  return fetchMonthly(employeeId).some(r => r.month === month);
}

// ============================================================
// SCHEDULED TRIGGERS — same cadence as before, now reading from Vercel
// ============================================================

function sendStemThursdayReminder() {
  const employees = getStemEmployees();
  const week = getCurrentWeek();
  employees.forEach(emp => {
    if (!hasSubmittedWeekly(emp.id, week)) {
      sendReminderEmail(emp.email, emp.name, "STEM Weekly Evaluation Due", `
        <p>This is a reminder to complete your <strong>weekly STEM OPT evaluation</strong> for ${week}.</p>
        <p>Please log in to BrightSharks and submit your evaluation today.</p>
      `);
    }
  });
}

function sendStemFridayReminder() {
  const employees = getStemEmployees();
  const week = getCurrentWeek();
  employees.forEach(emp => {
    if (!hasSubmittedWeekly(emp.id, week)) {
      sendReminderEmail(emp.email, emp.name, "⚠️ Reminder: STEM Evaluation Still Pending", `
        <p>You have not yet submitted your <strong>weekly STEM OPT evaluation</strong> for ${week}.</p>
        <p>Please complete it today (Friday) to stay on track.</p>
      `);
    }
  });
}

function sendStemMondayUrgent() {
  const employees = getStemEmployees();
  const lastWeek  = getLastWeek();
  const missing   = [];

  employees.forEach(emp => {
    if (!hasSubmittedWeekly(emp.id, lastWeek)) {
      missing.push(emp.name);
      sendReminderEmail(emp.email, emp.name, "🚨 URGENT: STEM Evaluation Overdue", `
        <p style="color:#c00"><strong>URGENT:</strong> Your STEM OPT weekly evaluation for ${lastWeek} is still missing.</p>
        <p>Please submit it immediately in BrightSharks.</p>
      `);
    }
  });

  if (missing.length > 0) {
    const managers = getManagerEmails();
    const list = missing.map(n => `<li>${n}</li>`).join("");
    managers.forEach(email => {
      try {
        MailApp.sendEmail({
          to: email,
          subject: `🚨 Missing STEM Evaluations — ${lastWeek}`,
          htmlBody: `
            <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
              <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
                <h2 style="color:#6c8fff;margin:0">BrightSharks</h2>
              </div>
              <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
                <p>The following employees have <strong>not submitted</strong> their STEM OPT evaluation for <strong>${lastWeek}</strong>:</p>
                <ul>${list}</ul>
                <p>Please follow up with them directly.</p>
              </div>
            </div>`
        });
      } catch (e) {}
    });
  }
}

function sendH1BDayBeforeReminder() {
  const employees = getH1BEmployees();
  const nextMonth = getNextMonth();
  employees.forEach(emp => {
    if (!hasSubmittedMonthly(emp.id, nextMonth)) {
      sendReminderEmail(emp.email, emp.name, "📋 H-1B Monthly Evaluation Due Tomorrow", `
        <p>Your <strong>monthly H-1B evaluation</strong> for ${nextMonth} is due <strong>tomorrow</strong>.</p>
        <p>Please log in to BrightSharks and submit it on time.</p>
      `);
    }
  });
}

function sendH1BEvalDayReminder() {
  const employees = getH1BEmployees();
  const month = getCurrentMonth();
  employees.forEach(emp => {
    if (!hasSubmittedMonthly(emp.id, month)) {
      sendReminderEmail(emp.email, emp.name, "📋 H-1B Monthly Evaluation Due Today", `
        <p>Your <strong>monthly H-1B evaluation</strong> for ${month} is due <strong>today</strong>.</p>
        <p>Please complete it now in BrightSharks.</p>
      `);
    }
  });
}

function sendH1BUrgentReminder() {
  const employees = getH1BEmployees();
  const month = getCurrentMonth();
  const missing = [];

  employees.forEach(emp => {
    if (!hasSubmittedMonthly(emp.id, month)) {
      missing.push(emp.name);
      sendReminderEmail(emp.email, emp.name, "🚨 URGENT: H-1B Evaluation Overdue", `
        <p style="color:#c00"><strong>URGENT:</strong> Your H-1B monthly evaluation for ${month} is overdue.</p>
        <p>Please submit it <strong>immediately</strong> in BrightSharks.</p>
      `);
    }
  });

  if (missing.length > 0) {
    const managers = getManagerEmails();
    const list = missing.map(n => `<li>${n}</li>`).join("");
    managers.forEach(email => {
      try {
        MailApp.sendEmail({
          to: email,
          subject: `🚨 Missing H-1B Evaluations — ${month}`,
          htmlBody: `
            <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
              <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
                <h2 style="color:#ff8c42;margin:0">BrightSharks</h2>
              </div>
              <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
                <p>The following employees have <strong>not submitted</strong> their H-1B monthly evaluation for <strong>${month}</strong>:</p>
                <ul>${list}</ul>
                <p>This is the 3rd working day overdue. Please follow up immediately.</p>
              </div>
            </div>`
        });
      } catch (e) {}
    });
  }
}

function sendH1BMonthlyManagerNudge() {
  const managers = getManagerEmails();
  const month = getCurrentMonth();
  const employees = getH1BEmployees();
  const submitted = employees.filter(e => hasSubmittedMonthly(e.id, month));
  const pending   = employees.filter(e => !hasSubmittedMonthly(e.id, month));
  const submittedList = submitted.map(e => `<li>${e.name}</li>`).join("") || "<li>None yet</li>";
  const pendingList   = pending.map(e => `<li>${e.name}</li>`).join("") || "<li>None — all submitted!</li>";

  managers.forEach(email => {
    try {
      MailApp.sendEmail({
        to: email,
        subject: `📋 H-1B Monthly Review Required — ${month}`,
        htmlBody: `
          <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
            <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
              <h2 style="color:#ff8c42;margin:0">BrightSharks</h2>
              <p style="color:#aaa;margin:4px 0 0;font-size:13px">Monthly Manager Review — ${month}</p>
            </div>
            <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
              <p>Please review and approve H-1B monthly evaluations for <strong>${month}</strong>.</p>
              <h4 style="margin-top:16px">✅ Submitted:</h4><ul>${submittedList}</ul>
              <h4 style="margin-top:16px">⏳ Pending:</h4><ul>${pendingList}</ul>
              <p style="margin-top:20px">Log in to BrightSharks to review all submissions.</p>
            </div>
          </div>`
      });
    } catch (e) {}
  });
}

function sendH1BAlternateDayFollowUp() {
  sendH1BMonthlyManagerNudge();
}

function checkAllH1BExpiries() {
  fetchAllEmployees()
    .filter(e => (e.profile && e.profile.visaType === "H1B" && e.profile.h1bExpiry))
    .forEach(e => checkH1BExpiry(e.id, e.profile));
}

// ============================================================
// HELPERS
// ============================================================

function sendReminderEmail(toEmail, name, subject, bodyHtml) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
      <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#e8c97e;margin:0">BrightSharks</h2>
      </div>
      <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
        <p>Hi ${name},</p>
        ${bodyHtml}
        <p style="color:#888;font-size:12px;margin-top:24px">This is an automated reminder from BrightSharks.</p>
      </div>
    </div>`;
  try { MailApp.sendEmail({ to: toEmail, subject, htmlBody: html }); } catch (e) {}
}

function getCurrentWeek() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}

function getLastWeek() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getNextMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

// ============================================================
// TRIGGER SETUP — run once to register all time-based triggers
// ============================================================
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("sendStemThursdayReminder").timeBased().onWeekDay(ScriptApp.WeekDay.THURSDAY).atHour(10).create();
  ScriptApp.newTrigger("sendStemFridayReminder").timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(10).create();
  ScriptApp.newTrigger("sendStemMondayUrgent").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).create();
  ScriptApp.newTrigger("h1bDailyRouter").timeBased().everyDays(1).atHour(10).create();
  ScriptApp.newTrigger("checkAllH1BExpiries").timeBased().everyDays(1).atHour(9).create();

  Logger.log("✅ All triggers created.");
}

function h1bDailyRouter() {
  const today = new Date();
  const day   = today.getDate();
  const dow   = today.getDay();

  if (day === 23) { sendH1BMonthlyManagerNudge(); return; }
  if (day > 23 && (day - 23) % 2 === 0) { sendH1BAlternateDayFollowUp(); return; }
  if (day === 22) { sendH1BDayBeforeReminder(); return; }
  if (day === 26 && dow !== 0 && dow !== 6) { sendH1BUrgentReminder(); }
}
