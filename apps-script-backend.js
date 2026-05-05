// ============================================================
// TeamPulse — Google Apps Script Backend
// Deploy as: Web App → Execute as: Me → Who has access: Anyone
// ============================================================

const SPREADSHEET_ID = "1LactsFRwfmDu_u7D_u1Wm3hFRgUQiC92iWGxXCPohlU"; // ← Replace this

// Email config — managers will be notified when employees submit weekly updates
const EMAIL_CONFIG = {
  SEND_NOTIFICATIONS: true,           // Set to false to disable all emails
  APP_NAME: "TeamPulse",
  // Optional: override and always notify a specific email (e.g. HR inbox)
  // Leave as "" to auto-detect managers from the Users sheet
  NOTIFY_EMAIL_OVERRIDE: "",
};

// Sheet names
const SHEETS = {
  USERS:   "Users",
  PROFILES:"Profiles",
  WEEKLY:  "Weekly",
  REVIEWS: "Reviews",
};

// ============================================================
// ENTRY POINT
// ============================================================
function doPost(e) {
  const cors = ContentService.createTextOutput();
  try {
    const payload = JSON.parse(e.postData.contents);
    const result = route(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, message: "TeamPulse API is running." }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ROUTER
// ============================================================
function route(payload) {
  switch (payload.action) {
    case "login":                return login(payload);
    case "inviteEmployee":       return inviteEmployee(payload);
    case "validateInviteToken":  return validateInviteToken(payload);
    case "setPassword":          return setPassword(payload);
    case "getProfile":           return getProfile(payload);
    case "saveProfile":          return saveProfile(payload);
    case "submitWeekly":         return submitWeekly(payload);
    case "getWeekly":            return getWeekly(payload);
    case "getAllEmployees":       return getAllEmployees();
    case "submitReview":         return submitReview(payload);
    case "getReviews":           return getReviews(payload);
    default:                     return { success: false, error: "Unknown action: " + payload.action };
  }
}

// ============================================================
// HELPERS
// ============================================================
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = {
      Users:    ["id", "name", "email", "password", "role", "status", "inviteToken"],
      Profiles: ["employeeId", "clientName", "clientManager", "teamLead", "role", "currentProjects", "updatedAt"],
      Weekly:   ["id", "employeeId", "employeeName", "week", "tasks", "deliverables", "support", "submittedAt"],
      Reviews:  ["id", "employeeId", "employeeName", "month", "comments", "reviewedBy", "reviewedAt"],
    };
    if (headers[name]) sheet.appendRow(headers[name]);
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function generateId() {
  return Utilities.getUuid().substring(0, 8);
}

function login(payload) {
  const sheet = getSheet(SHEETS.USERS);
  const users = sheetToObjects(sheet);
  const user = users.find(u => u.email === payload.email && u.password === payload.password && u.status === "active");
  if (!user) {
    const pending = users.find(u => u.email === payload.email && u.status === "pending");
    if (pending) return { success: false, error: "Your account is pending. Please check your email for the invite link." };
    return { success: false, error: "Invalid email or password." };
  }
  return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

// ============================================================
// INVITE FLOW
// ============================================================
function inviteEmployee(payload) {
  const sheet = getSheet(SHEETS.USERS);
  const users = sheetToObjects(sheet);
  if (users.find(u => u.email === payload.email)) {
    return { success: false, error: "An account with this email already exists." };
  }

  const token = Utilities.getUuid();
  const inviteLink = `${payload.appUrl}?invite=${token}`;

  sheet.appendRow([generateId(), payload.name, payload.email, "", "employee", "pending", token]);

  // Send invite email
  try {
    MailApp.sendEmail({
      to: payload.email,
      subject: `You've been invited to TeamPulse`,
      body: `Hi ${payload.name},\n\nYou've been invited to join TeamPulse. Click the link below to set your password and activate your account:\n\n${inviteLink}\n\nThis link can only be used once.\n\nTeamPulse`,
      htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
  <div style="background: #1a1a2e; padding: 24px 32px; border-radius: 8px 8px 0 0;">
    <h2 style="color: #e8c97e; margin: 0;">TeamPulse</h2>
  </div>
  <div style="background: #f9f9f9; padding: 28px 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <p>Hi <strong>${payload.name}</strong>,</p>
    <p>You've been invited to join <strong>TeamPulse</strong>. Click the button below to set your password and activate your account.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${inviteLink}" style="background: #e8c97e; color: #111; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1rem;">Activate My Account</a>
    </div>
    <p style="font-size: 0.8rem; color: #999;">This link can only be used once. If you didn't expect this email, you can ignore it.</p>
  </div>
</div>`
    });
  } catch(err) {
    Logger.log("Invite email failed: " + err.message);
  }

  return { success: true, name: payload.name };
}

function validateInviteToken(payload) {
  const sheet = getSheet(SHEETS.USERS);
  const users = sheetToObjects(sheet);
  const user = users.find(u => u.inviteToken === payload.token && u.status === "pending");
  if (!user) return { success: false, error: "Invalid or expired invite link." };
  return { success: true, user: { id: user.id, name: user.name, email: user.email } };
}

function setPassword(payload) {
  const sheet = getSheet(SHEETS.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const tokenIdx = headers.indexOf("inviteToken");
  const passwordIdx = headers.indexOf("password");
  const statusIdx = headers.indexOf("status");

  for (let i = 1; i < data.length; i++) {
    if (data[i][tokenIdx] === payload.token && data[i][statusIdx] === "pending") {
      sheet.getRange(i + 1, passwordIdx + 1).setValue(payload.password);
      sheet.getRange(i + 1, statusIdx + 1).setValue("active");
      sheet.getRange(i + 1, tokenIdx + 1).setValue("");
      const user = {};
      headers.forEach((h, j) => user[h] = data[i][j]);
      return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }
  }
  return { success: false, error: "Invalid or expired invite link." };
}

// ============================================================
// PROFILES
// ============================================================
function getProfile(payload) {
  const sheet = getSheet(SHEETS.PROFILES);
  const rows = sheetToObjects(sheet);
  const profile = rows.find(r => r.employeeId === payload.employeeId);
  if (!profile) return { success: true, profile: null };
  const { employeeId, updatedAt, ...rest } = profile;
  return { success: true, profile: rest };
}

function saveProfile(payload) {
  const sheet = getSheet(SHEETS.PROFILES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const empIdx = headers.indexOf("employeeId");

  // Find existing row
  for (let i = 1; i < data.length; i++) {
    if (data[i][empIdx] === payload.employeeId) {
      // Update existing row
      const p = payload.profile;
      data[i] = [payload.employeeId, p.clientName, p.clientManager, p.teamLead, p.role, p.currentProjects, new Date().toISOString()];
      sheet.getRange(i + 1, 1, 1, data[i].length).setValues([data[i]]);
      return { success: true };
    }
  }

  // New row
  const p = payload.profile;
  sheet.appendRow([payload.employeeId, p.clientName, p.clientManager, p.teamLead, p.role, p.currentProjects, new Date().toISOString()]);
  return { success: true };
}

// ============================================================
// WEEKLY UPDATES
// ============================================================
function submitWeekly(payload) {
  const sheet = getSheet(SHEETS.WEEKLY);
  const d = payload.data;
  sheet.appendRow([generateId(), d.employeeId, d.employeeName, d.week, d.tasks, d.deliverables, d.support, new Date().toISOString().split("T")[0]]);

  // Send email notifications
  if (EMAIL_CONFIG.SEND_NOTIFICATIONS) {
    try {
      sendWeeklyNotification(d);
    } catch (err) {
      Logger.log("Email notification failed: " + err.message);
      // Don't fail the whole request if email fails
    }
  }

  return { success: true };
}

function sendWeeklyNotification(d) {
  // Get recipients
  let recipients = [];

  if (EMAIL_CONFIG.NOTIFY_EMAIL_OVERRIDE) {
    recipients = [EMAIL_CONFIG.NOTIFY_EMAIL_OVERRIDE];
  } else {
    // Auto-detect all managers from Users sheet
    const users = sheetToObjects(getSheet(SHEETS.USERS));
    recipients = users.filter(u => u.role === "manager").map(u => u.email).filter(Boolean);
  }

  if (recipients.length === 0) {
    Logger.log("No manager email recipients found.");
    return;
  }

  const subject = `[${EMAIL_CONFIG.APP_NAME}] Weekly Update from ${d.employeeName} — ${d.week}`;

  const body = `
Hi,

${d.employeeName} has submitted their weekly update for ${d.week}.

━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT TASKS
━━━━━━━━━━━━━━━━━━━━━━━━━━
${d.tasks || "—"}

━━━━━━━━━━━━━━━━━━━━━━━━━━
DELIVERABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━
${d.deliverables || "—"}

━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━
${d.support || "None"}

━━━━━━━━━━━━━━━━━━━━━━━━━━
Submitted on: ${new Date().toDateString()}

Log in to TeamPulse to view all updates and submit a review.
  `.trim();

  const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background: #1a1a2e; padding: 24px 32px; border-radius: 8px 8px 0 0;">
    <h2 style="color: #e8c97e; margin: 0; font-size: 1.4rem;">TeamPulse</h2>
    <p style="color: #aaa; margin: 4px 0 0; font-size: 0.85rem;">Weekly Update Notification</p>
  </div>
  <div style="background: #f9f9f9; padding: 28px 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 1rem; margin-bottom: 20px;">
      <strong>${d.employeeName}</strong> has submitted their weekly update for <strong>${d.week}</strong>.
    </p>

    <div style="background: white; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
      <div style="background: #f0f0f0; padding: 10px 16px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #666;">Current Tasks</div>
      <div style="padding: 14px 16px; font-size: 0.9rem;">${d.tasks || "—"}</div>
    </div>

    <div style="background: white; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
      <div style="background: #f0f0f0; padding: 10px 16px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #666;">Deliverables</div>
      <div style="padding: 14px 16px; font-size: 0.9rem;">${d.deliverables || "—"}</div>
    </div>

    <div style="background: white; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; margin-bottom: 24px;">
      <div style="background: #fff3e0; padding: 10px 16px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #e65100;">Support Required</div>
      <div style="padding: 14px 16px; font-size: 0.9rem;">${d.support || "None"}</div>
    </div>

    <p style="font-size: 0.78rem; color: #999; margin: 0;">Submitted on ${new Date().toDateString()}</p>
  </div>
</div>
  `.trim();

  recipients.forEach(email => {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
    });
  });

  Logger.log("Notification sent to: " + recipients.join(", "));
}

function getWeekly(payload) {
  const sheet = getSheet(SHEETS.WEEKLY);
  let rows = sheetToObjects(sheet);
  if (payload.employeeId) rows = rows.filter(r => r.employeeId === payload.employeeId);
  return { success: true, data: rows };
}

// ============================================================
// EMPLOYEES LIST
// ============================================================
function getAllEmployees() {
  const sheet = getSheet(SHEETS.USERS);
  const users = sheetToObjects(sheet).filter(u => u.role === "employee");
  return { success: true, employees: users.map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status })) };
}

// ============================================================
// REVIEWS
// ============================================================
function submitReview(payload) {
  const sheet = getSheet(SHEETS.REVIEWS);
  const d = payload.data;
  sheet.appendRow([generateId(), d.employeeId, d.employeeName, d.month, d.comments, d.reviewedBy, new Date().toISOString().split("T")[0]]);
  return { success: true };
}

function getReviews(payload) {
  const sheet = getSheet(SHEETS.REVIEWS);
  let rows = sheetToObjects(sheet);
  if (payload.employeeId) rows = rows.filter(r => r.employeeId === payload.employeeId);
  return { success: true, data: rows };
}

// ============================================================
// SETUP — Run this once manually to create seed users
// ============================================================
function setupInitialUsers() {
  const sheet = getSheet(SHEETS.USERS);
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);

  // Columns: id, name, email, password, role, status, inviteToken
  const users = [
    [generateId(), "Ankit Gupta",  "ankit@company.com",  "manager123", "manager",  "active",  ""],
    [generateId(), "Priya Sharma", "priya@company.com",  "pass123",    "employee", "active",  ""],
    [generateId(), "Rahul Verma",  "rahul@company.com",  "pass123",    "employee", "active",  ""],
    // Add more employees below:
    // [generateId(), "Name", "email@company.com", "password", "employee", "active", ""],
  ];

  users.forEach(u => sheet.appendRow(u));
  Logger.log("Setup complete. " + users.length + " users created.");
}
