// ============================================================
// TeamPulse v2 — Google Apps Script Backend
// Deploy: Extensions → Apps Script → Deploy as Web App
//         Execute as: Me | Who has access: Anyone
// ============================================================

const SPREADSHEET_ID = "1LactsFRwfmDu_u7D_u1Wm3hFRgUQiC92iWGxXCPohlU"; // ← Replace with your Sheet ID
const HR_EMAIL = "yashwanthreddyvutukori45@gmail.com";           // ← Replace with HR email

const SHEETS = {
  USERS:    "Users",
  PROFILES: "Profiles",
  WEEKLY:   "Weekly",      // STEM OPT weekly evaluations
  MONTHLY:  "Monthly",     // H-1B monthly evaluations
};

// ============================================================
// WEB APP ENTRY POINTS
// ============================================================
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result  = route(payload);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doGet() {
  return jsonResponse({ success: true, message: "TeamPulse v2 API running." });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ROUTER
// ============================================================
function route(p) {
  switch (p.action) {
    case "login":              return login(p.data);
    case "getAllUsers":         return getAllUsers();
    case "createUser":         return createUser(p.data);
    case "deleteUser":         return deleteUser(p.userId);
    case "getManagers":        return getManagers();
    case "getProfile":         return getProfile(p.userId);
    case "saveProfile":        return saveProfile(p.userId, p.data);
    case "getWeekly":          return getWeekly(p.employeeId);
    case "submitWeekly":       return submitWeekly(p.data);
    case "getMonthly":         return getMonthly(p.employeeId);
    case "submitMonthly":      return submitMonthly(p.data);
    case "getAllEmployees":     return getAllEmployees();
    case "getAllUpdates":       return getAllUpdates();
    case "editUpdate":         return editUpdate(p.data);
    case "editEmployeeInfo":   return editEmployeeInfo(p.userId, p.data);
    case "inviteEmployee":     return inviteEmployee(p.data);
    default:                   return { success: false, error: "Unknown action: " + p.action };
  }
}

// ============================================================
// USER MANAGEMENT
// ============================================================
function getAllUsers() {
  const users = getSheet(SHEETS.USERS).getDataRange().getValues();
  const data  = [];
  for (let i = 1; i < users.length; i++) {
    const [id, email, password, name, role, visaType] = users[i];
    if (id) data.push({ id, email, password, name, role, visaType });
  }
  return { success: true, data };
}

function createUser(data) {
  const sheet = getSheet(SHEETS.USERS);
  const rows  = sheet.getDataRange().getValues();
  // Check for duplicate email
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === data.email) return { success: false, error: "A user with this email already exists." };
  }
  const id = "u_" + Utilities.getUuid().replace(/-/g, "").slice(0, 10);
  sheet.appendRow([id, data.email, data.password, data.name, data.role, data.visaType || ""]);
  return { success: true, id };
}

function deleteUser(userId) {
  const sheet = getSheet(SHEETS.USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === userId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "User not found." };
}

// ============================================================
// INVITE EMPLOYEE
// ============================================================
function inviteEmployee(data) {
  const sheet = getSheet(SHEETS.USERS);
  const rows  = sheet.getDataRange().getValues();

  // Check if email already exists
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === data.email) {
      return { success: false, error: "An account with this email already exists." };
    }
  }

  // Generate a simple password: first name + 4 random digits
  const firstName  = data.name.split(" ")[0];
  const randDigits = Math.floor(1000 + Math.random() * 9000);
  const password   = `${firstName}@${randDigits}`;
  const userId     = "u_" + Utilities.getUuid().replace(/-/g, "").slice(0, 8);

  // Add to Users sheet
  sheet.appendRow([userId, data.email, password, data.name, "employee", data.visaType || ""]);

  // Send welcome email
  const appUrl = "https://your-teampulse-vercel-url.vercel.app"; // ← update with your Vercel URL
  const visaLabel = data.visaType === "STEM_OPT" ? "STEM OPT" : data.visaType === "H1B" ? "H-1B" : data.visaType || "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
      <div style="background:#0c0d10;padding:28px 32px;border-radius:10px 10px 0 0">
        <h1 style="color:#6c8fff;margin:0;font-size:1.6rem;letter-spacing:-0.5px">TeamPulse</h1>
        <p style="color:#888;margin:6px 0 0;font-size:13px">You've been invited to the team portal</p>
      </div>
      <div style="background:#f9f9f9;padding:28px 32px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px">
        <p style="font-size:15px">Hi <strong>${data.name}</strong>,</p>
        <p>${data.invitedBy || "Your manager"} has added you to <strong>TeamPulse</strong> — your compliance and evaluation portal.</p>

        <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:24px 0">
          <p style="margin:0 0 12px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;color:#888">Your Login Details</p>
          <p style="margin:0 0 8px"><strong>Portal:</strong> <a href="${appUrl}" style="color:#6c8fff">${appUrl}</a></p>
          <p style="margin:0 0 8px"><strong>Email:</strong> ${data.email}</p>
          <p style="margin:0 0 8px"><strong>Password:</strong> <code style="background:#f0f0f0;padding:2px 8px;border-radius:4px;font-size:14px">${password}</code></p>
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
    MailApp.sendEmail({ to: data.email, subject: `Welcome to TeamPulse — Your Login Details`, htmlBody: html });
  } catch (e) {
    // Still return success even if email fails — user was created
    return { success: true, warning: "User created but email failed: " + e.message };
  }

  return { success: true };
}

// ============================================================
// MANAGERS LIST
// ============================================================
function getManagers() {
  const users = getSheet(SHEETS.USERS).getDataRange().getValues();
  const data  = [];
  for (let i = 1; i < users.length; i++) {
    if (users[i][4] === "manager") {
      data.push({ id: users[i][0], name: users[i][3], email: users[i][1] });
    }
  }
  return { success: true, data };
}

// ============================================================
// AUTH
// ============================================================
function login(data) {
  const sheet = getSheet(SHEETS.USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const [id, email, password, name, role, visaType] = rows[i];
    if (email === data.email && password === data.password) {
      return { success: true, user: { id, email, name, role, visaType } };
    }
  }
  return { success: false, error: "Invalid credentials." };
}

// ============================================================
// PROFILES
// ============================================================
function getProfile(userId) {
  const sheet = getSheet(SHEETS.PROFILES);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === userId) {
      return { success: true, data: JSON.parse(rows[i][1] || "{}") };
    }
  }
  return { success: true, data: {} };
}

function saveProfile(userId, data) {
  const sheet = getSheet(SHEETS.PROFILES);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === userId) {
      sheet.getRange(i + 1, 2).setValue(JSON.stringify(data));
      // Check H1B expiry on every save
      if (data.visaType === "H1B" && data.h1bExpiry) {
        checkH1BExpiry(userId, data);
      }
      return { success: true };
    }
  }
  sheet.appendRow([userId, JSON.stringify(data), new Date().toISOString()]);
  if (data.visaType === "H1B" && data.h1bExpiry) {
    checkH1BExpiry(userId, data);
  }
  return { success: true };
}

function editEmployeeInfo(userId, data) {
  return saveProfile(userId, data);
}

// ============================================================
// WEEKLY (STEM OPT)
// ============================================================
function getWeekly(employeeId) {
  const sheet = getSheet(SHEETS.WEEKLY);
  const rows  = sheet.getDataRange().getValues();
  const data  = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === employeeId) {
      try { data.push(JSON.parse(rows[i][2] || "{}")); } catch {}
    }
  }
  return { success: true, data };
}

function submitWeekly(data) {
  const sheet = getSheet(SHEETS.WEEKLY);
  const id    = Utilities.getUuid();
  const now   = new Date().toISOString();
  const row   = { ...data, id, submittedAt: now, type: "weekly" };
  sheet.appendRow([data.employeeId, data.employeeName, JSON.stringify(row), data.week, now, "false"]);

  // Email: notify manager about support if requested
  if (data.supportNeeded) {
    emailSupportRequest(data);
  }

  // Check if this is the 4th week (every 4th submission triggers email)
  const all = getWeekly(data.employeeId).data;
  if (all.length > 0 && all.length % 4 === 0) {
    emailManager4thWeek(data, all);
  }

  return { success: true };
}

// ============================================================
// MONTHLY (H-1B)
// ============================================================
function getMonthly(employeeId) {
  const sheet = getSheet(SHEETS.MONTHLY);
  const rows  = sheet.getDataRange().getValues();
  const data  = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === employeeId) {
      try { data.push(JSON.parse(rows[i][2] || "{}")); } catch {}
    }
  }
  return { success: true, data };
}

function submitMonthly(data) {
  const sheet = getSheet(SHEETS.MONTHLY);
  const id    = Utilities.getUuid();
  const now   = new Date().toISOString();
  const row   = { ...data, id, submittedAt: now, type: "monthly" };
  sheet.appendRow([data.employeeId, data.employeeName, JSON.stringify(row), data.month, now, "false"]);

  if (data.supportNeeded) {
    emailSupportRequest(data);
  }

  return { success: true };
}

// ============================================================
// MANAGER — ALL UPDATES
// ============================================================
function getAllEmployees() {
  const users    = getSheet(SHEETS.USERS).getDataRange().getValues();
  const profiles = getSheet(SHEETS.PROFILES).getDataRange().getValues();
  const profMap  = {};
  for (let i = 1; i < profiles.length; i++) {
    try { profMap[profiles[i][0]] = JSON.parse(profiles[i][1] || "{}"); } catch {}
  }
  const data = [];
  for (let i = 1; i < users.length; i++) {
    const [id, email, , name, role, visaType] = users[i];
    if (role === "employee") {
      data.push({ id, email, name, role, visaType, profile: profMap[id] || {} });
    }
  }
  return { success: true, data };
}

function getAllUpdates() {
  const weekly  = getSheet(SHEETS.WEEKLY).getDataRange().getValues();
  const monthly = getSheet(SHEETS.MONTHLY).getDataRange().getValues();
  const data    = [];
  for (let i = 1; i < weekly.length; i++) {
    try { data.push({ ...JSON.parse(weekly[i][2] || "{}"), type: "weekly" }); } catch {}
  }
  for (let i = 1; i < monthly.length; i++) {
    try { data.push({ ...JSON.parse(monthly[i][2] || "{}"), type: "monthly" }); } catch {}
  }
  const usersRes = getAllEmployees();
  return { success: true, data, employees: usersRes.data };
}

function editUpdate(data) {
  // Edit weekly
  const wSheet = getSheet(SHEETS.WEEKLY);
  const wRows  = wSheet.getDataRange().getValues();
  for (let i = 1; i < wRows.length; i++) {
    try {
      const row = JSON.parse(wRows[i][2] || "{}");
      if (row.id === data.id) {
        // Preserve original submittedAt — only update manager fields
        const updated = { ...row, managerComment: data.managerComment, reviewedByManager: data.reviewedByManager };
        wSheet.getRange(i + 1, 3).setValue(JSON.stringify(updated));
        wSheet.getRange(i + 1, 6).setValue(String(data.reviewedByManager));
        return { success: true };
      }
    } catch {}
  }
  // Edit monthly
  const mSheet = getSheet(SHEETS.MONTHLY);
  const mRows  = mSheet.getDataRange().getValues();
  for (let i = 1; i < mRows.length; i++) {
    try {
      const row = JSON.parse(mRows[i][2] || "{}");
      if (row.id === data.id) {
        const updated = { ...row, managerComment: data.managerComment, reviewedByManager: data.reviewedByManager };
        mSheet.getRange(i + 1, 3).setValue(JSON.stringify(updated));
        mSheet.getRange(i + 1, 6).setValue(String(data.reviewedByManager));
        return { success: true };
      }
    } catch {}
  }
  return { success: false, error: "Update not found." };
}

// ============================================================
// EMAIL HELPERS
// ============================================================

function getManagerEmailsForEmployee(employeeId) {
  // First check if employee has an assigned BrightSharks manager in their profile
  const profRes = getProfile(employeeId);
  if (profRes.success && profRes.data && profRes.data.brightsharksManagerEmail) {
    return [profRes.data.brightsharksManagerEmail];
  }
  // Fallback: return all manager emails
  return getManagerEmails();
}

function emailSupportRequest(data) {
  const managers = getManagerEmailsForEmployee(data.employeeId);
  if (!managers.length) return;
  const subject = `🆘 Support Request: ${data.employeeName}`;
  const body = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
      <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#e8c97e;margin:0">TeamPulse</h2>
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
}

function emailManager4thWeek(data, allWeekly) {
  const managers = getManagerEmailsForEmployee(data.employeeId);
  if (!managers.length) return;
  const subject = `📊 4-Week Evaluation Complete: ${data.employeeName}`;
  const body = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
      <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#6c8fff;margin:0">TeamPulse</h2>
        <p style="color:#aaa;margin:4px 0 0;font-size:13px">STEM OPT — 4-Week Milestone</p>
      </div>
      <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
        <p><strong>${data.employeeName}</strong> has completed their <strong>${allWeekly.length}th weekly evaluation</strong> (every 4th week milestone).</p>
        <p>Please log in to TeamPulse to review and approve their 4-week period evaluations.</p>
      </div>
    </div>`;
  managers.forEach(email => {
    try { MailApp.sendEmail({ to: email, subject, htmlBody: body }); } catch (e) {}
  });
}

// ============================================================
// SCHEDULED TRIGGERS — Run via Apps Script Time-based Triggers
// ============================================================

// ── STEM OPT: Thursday 10am reminder to employees ──
function sendStemThursdayReminder() {
  const employees = getStemEmployees();
  const week = getCurrentWeek();
  employees.forEach(emp => {
    if (!hasSubmittedWeekly(emp.id, week)) {
      sendReminderEmail(emp.email, emp.name, "STEM Weekly Evaluation Due", `
        <p>This is a reminder to complete your <strong>weekly STEM OPT evaluation</strong> for ${week}.</p>
        <p>Please log in to TeamPulse and submit your evaluation today.</p>
      `);
    }
  });
}

// ── STEM OPT: Friday 10am second reminder ──
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

// ── STEM OPT: Monday 10am urgent reminder to employee + manager list ──
function sendStemMondayUrgent() {
  const employees = getStemEmployees();
  const lastWeek  = getLastWeek();
  const missing   = [];

  employees.forEach(emp => {
    if (!hasSubmittedWeekly(emp.id, lastWeek)) {
      missing.push(emp.name);
      sendReminderEmail(emp.email, emp.name, "🚨 URGENT: STEM Evaluation Overdue", `
        <p style="color:#c00"><strong>URGENT:</strong> Your STEM OPT weekly evaluation for ${lastWeek} is still missing.</p>
        <p>Please submit it immediately in TeamPulse.</p>
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
                <h2 style="color:#6c8fff;margin:0">TeamPulse</h2>
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

// ── H-1B: Day-before reminder (10am) ──
function sendH1BDayBeforeReminder() {
  const employees = getH1BEmployees();
  const nextMonth = getNextMonth();
  employees.forEach(emp => {
    if (!hasSubmittedMonthly(emp.id, nextMonth)) {
      sendReminderEmail(emp.email, emp.name, "📋 H-1B Monthly Evaluation Due Tomorrow", `
        <p>Your <strong>monthly H-1B evaluation</strong> for ${nextMonth} is due <strong>tomorrow</strong>.</p>
        <p>Please log in to TeamPulse and submit it on time.</p>
      `);
    }
  });
}

// ── H-1B: Evaluation day reminder (10am) ──
function sendH1BEvalDayReminder() {
  const employees = getH1BEmployees();
  const month = getCurrentMonth();
  employees.forEach(emp => {
    if (!hasSubmittedMonthly(emp.id, month)) {
      sendReminderEmail(emp.email, emp.name, "📋 H-1B Monthly Evaluation Due Today", `
        <p>Your <strong>monthly H-1B evaluation</strong> for ${month} is due <strong>today</strong>.</p>
        <p>Please complete it now in TeamPulse.</p>
      `);
    }
  });
}

// ── H-1B: 3rd working day urgent reminder (10am) ──
function sendH1BUrgentReminder() {
  const employees = getH1BEmployees();
  const month = getCurrentMonth();
  const missing = [];

  employees.forEach(emp => {
    if (!hasSubmittedMonthly(emp.id, month)) {
      missing.push(emp.name);
      sendReminderEmail(emp.email, emp.name, "🚨 URGENT: H-1B Evaluation Overdue", `
        <p style="color:#c00"><strong>URGENT:</strong> Your H-1B monthly evaluation for ${month} is overdue.</p>
        <p>Please submit it <strong>immediately</strong> in TeamPulse.</p>
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
                <h2 style="color:#ff8c42;margin:0">TeamPulse</h2>
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

// ── H-1B: 23rd of every month — Manager review nudge ──
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
              <h2 style="color:#ff8c42;margin:0">TeamPulse</h2>
              <p style="color:#aaa;margin:4px 0 0;font-size:13px">Monthly Manager Review — ${month}</p>
            </div>
            <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
              <p>Please review and approve H-1B monthly evaluations for <strong>${month}</strong>.</p>
              <h4 style="margin-top:16px">✅ Submitted:</h4><ul>${submittedList}</ul>
              <h4 style="margin-top:16px">⏳ Pending:</h4><ul>${pendingList}</ul>
              <p style="margin-top:20px">Log in to TeamPulse to review all submissions.</p>
            </div>
          </div>`
      });
    } catch (e) {}
  });
}

// ── H-1B: Alternate-day follow-up after 23rd ──
function sendH1BAlternateDayFollowUp() {
  sendH1BMonthlyManagerNudge(); // Same template, triggered on alternate days
}

// ── H-1B Expiry Check — runs daily ──
function checkAllH1BExpiries() {
  const profiles = getSheet(SHEETS.PROFILES).getDataRange().getValues();
  const users    = getSheet(SHEETS.USERS).getDataRange().getValues();
  const userMap  = {};
  for (let i = 1; i < users.length; i++) userMap[users[i][0]] = { email: users[i][1], name: users[i][3] };

  for (let i = 1; i < profiles.length; i++) {
    try {
      const userId = profiles[i][0];
      const data   = JSON.parse(profiles[i][1] || "{}");
      if (data.visaType === "H1B" && data.h1bExpiry) {
        checkH1BExpiry(userId, data);
      }
    } catch {}
  }
}

function checkH1BExpiry(userId, data) {
  const expiry = new Date(data.h1bExpiry);
  const now    = new Date();
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  // Alert at exactly 180 days before expiry
  if (daysLeft === 180) {
    const managers = getManagerEmails();
    const subject  = `⚠️ H-1B Expiry Alert: ${data.clientName || "Employee"} — 6 months remaining`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
        <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
          <h2 style="color:#ffbe3d;margin:0">TeamPulse — H-1B Expiry Alert</h2>
        </div>
        <div style="background:#fff8ec;padding:24px 28px;border:1px solid #f0d080;border-top:none;border-radius:0 0 8px 8px">
          <p>⚠️ <strong>${data.i983?.studentName || "An employee"}</strong>'s H-1B visa expires in <strong>6 months (${data.h1bExpiry})</strong>.</p>
          <p>Please begin the renewal or transfer process immediately to avoid status gaps.</p>
          <p><strong>LCA Job Duties on file:</strong> ${data.lcaJobDuties || "Not provided"}</p>
        </div>
      </div>`;
    managers.forEach(email => {
      try { MailApp.sendEmail({ to: email, subject, htmlBody: html }); } catch (e) {}
    });
    try { MailApp.sendEmail({ to: HR_EMAIL, subject, htmlBody: html }); } catch (e) {}
  }
}

// ============================================================
// HELPER UTILITIES
// ============================================================

function sendReminderEmail(toEmail, name, subject, bodyHtml) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333">
      <div style="background:#1a1a2e;padding:20px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#e8c97e;margin:0">TeamPulse</h2>
      </div>
      <div style="background:#f9f9f9;padding:24px 28px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
        <p>Hi ${name},</p>
        ${bodyHtml}
        <p style="color:#888;font-size:12px;margin-top:24px">This is an automated reminder from TeamPulse.</p>
      </div>
    </div>`;
  try { MailApp.sendEmail({ to: toEmail, subject, htmlBody: html }); } catch (e) {}
}

function getStemEmployees() {
  const users    = getSheet(SHEETS.USERS).getDataRange().getValues();
  const profiles = getSheet(SHEETS.PROFILES).getDataRange().getValues();
  const profMap  = {};
  for (let i = 1; i < profiles.length; i++) {
    try { profMap[profiles[i][0]] = JSON.parse(profiles[i][1] || "{}"); } catch {}
  }
  return users.slice(1)
    .filter(r => r[4] === "employee" && (r[5] === "STEM_OPT" || (profMap[r[0]] && profMap[r[0]].visaType === "STEM_OPT")))
    .map(r => ({ id: r[0], email: r[1], name: r[3] }));
}

function getH1BEmployees() {
  const users    = getSheet(SHEETS.USERS).getDataRange().getValues();
  const profiles = getSheet(SHEETS.PROFILES).getDataRange().getValues();
  const profMap  = {};
  for (let i = 1; i < profiles.length; i++) {
    try { profMap[profiles[i][0]] = JSON.parse(profiles[i][1] || "{}"); } catch {}
  }
  return users.slice(1)
    .filter(r => r[4] === "employee" && (r[5] === "H1B" || (profMap[r[0]] && profMap[r[0]].visaType === "H1B")))
    .map(r => ({ id: r[0], email: r[1], name: r[3] }));
}

function getManagerEmails() {
  const users = getSheet(SHEETS.USERS).getDataRange().getValues();
  return users.slice(1).filter(r => r[4] === "manager").map(r => r[1]);
}

function hasSubmittedWeekly(employeeId, week) {
  const rows = getSheet(SHEETS.WEEKLY).getDataRange().getValues();
  return rows.slice(1).some(r => r[0] === employeeId && r[3] === week);
}

function hasSubmittedMonthly(employeeId, month) {
  const rows = getSheet(SHEETS.MONTHLY).getDataRange().getValues();
  return rows.slice(1).some(r => r[0] === employeeId && r[3] === month);
}

function getCurrentWeek() {
  const d    = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}

function getLastWeek() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
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
// ONE-TIME SETUP — Run once to create sheets and demo users
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetDefs = {
    [SHEETS.USERS]:    ["id", "email", "password", "name", "role", "visaType"],
    [SHEETS.PROFILES]: ["userId", "profileJson", "updatedAt"],
    [SHEETS.WEEKLY]:   ["employeeId", "employeeName", "dataJson", "week", "submittedAt", "reviewed"],
    [SHEETS.MONTHLY]:  ["employeeId", "employeeName", "dataJson", "month", "submittedAt", "reviewed"],
  };

  Object.entries(sheetDefs).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  });

  // Demo users — add your real team here
  const users = getSheet(SHEETS.USERS);
  const existing = users.getDataRange().getValues().slice(1).map(r => r[1]);

  const demoUsers = [
    ["u_mgr1",  "manager@yourcompany.com",  "Manager@123", "Your Manager",   "manager",  ""],
    ["u_stem1", "stem.employee@company.com", "Stem@123",    "STEM Employee",  "employee", "STEM_OPT"],
    ["u_h1b1",  "h1b.employee@company.com",  "H1b@123",    "H1B Employee",   "employee", "H1B"],
  ];

  demoUsers.forEach(row => {
    if (!existing.includes(row[1])) users.appendRow(row);
  });

  Logger.log("✅ Setup complete. Sheets and demo users created.");
}

// ============================================================
// TRIGGER SETUP — Run once to register all time-based triggers
// ============================================================
function setupTriggers() {
  // Delete existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // STEM — Thursday 10am
  ScriptApp.newTrigger("sendStemThursdayReminder").timeBased().onWeekDay(ScriptApp.WeekDay.THURSDAY).atHour(10).create();

  // STEM — Friday 10am
  ScriptApp.newTrigger("sendStemFridayReminder").timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(10).create();

  // STEM — Monday 10am urgent
  ScriptApp.newTrigger("sendStemMondayUrgent").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).create();

  // H1B — Every day at 10am (function checks which day/month it is)
  ScriptApp.newTrigger("h1bDailyRouter").timeBased().everyDays(1).atHour(10).create();

  // H1B expiry — Daily check
  ScriptApp.newTrigger("checkAllH1BExpiries").timeBased().everyDays(1).atHour(9).create();

  Logger.log("✅ All triggers created.");
}

// Daily router — handles H1B day-before, eval-day, urgent, 23rd nudge, alternate-day follow-up
function h1bDailyRouter() {
  const today = new Date();
  const day   = today.getDate();
  const dow   = today.getDay(); // 0=Sun, 1=Mon... 5=Fri, 6=Sat

  // 23rd of every month — manager nudge
  if (day === 23) {
    sendH1BMonthlyManagerNudge();
    return;
  }

  // Alternate days after 23rd (25, 27, 29...) — follow-up
  if (day > 23 && (day - 23) % 2 === 0) {
    sendH1BAlternateDayFollowUp();
    return;
  }

  // Day before evaluation due (22nd for a 23rd deadline)
  if (day === 22) {
    sendH1BDayBeforeReminder();
    return;
  }

  // Evaluation day reminder handled by 23rd above
  // 3rd working day after 23rd: ~26th (skipping weekends)
  // Simple approach: 26th = 3 calendar days after 23rd
  if (day === 26 && dow !== 0 && dow !== 6) {
    sendH1BUrgentReminder();
  }
}