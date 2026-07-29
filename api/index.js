// ============================================================
// BrightSharks v2 — Vercel API (data layer)
// Single endpoint /api with action-based router so the frontend
// only swaps the API_URL. Email-side-effects are forwarded to
// the Apps Script backend (kept as the email service).
// ============================================================

import { sql, shortId } from "./_db.js";

// Apps Script web app that sends the transactional email.
// The env var wins; the literal below is the currently deployed web app and
// exists so a missing/forgotten Vercel env var can't silently kill all email.
const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbzeXZWD3CBa-KTVofrWg6bixBsyYDfJQfy4pLzgjVUUxCQZgVWsCifYf2bZCRybdN97/exec";

// ────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "POST only" });

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  payload = payload || {};

  try {
    const result = await route(payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ────────────────────────────────────────────────────────────
// Router (mirrors apps-script-backend.js)
// ────────────────────────────────────────────────────────────
async function route(p) {
  switch (p.action) {
    case "login":            return login(p.data);
    case "getAllUsers":      return getAllUsers();
    case "createUser":       return createUser(p.data);
    case "deleteUser":       return deleteUser(p.userId);
    case "getManagers":      return getManagers();
    case "getProfile":       return getProfile(p.userId);
    case "saveProfile":      return saveProfile(p.userId, p.data);
    case "getWeekly":        return getWeekly(p.employeeId);
    case "submitWeekly":     return submitWeekly(p.data);
    case "getMonthly":       return getMonthly(p.employeeId);
    case "submitMonthly":    return submitMonthly(p.data);
    case "getAllEmployees":  return getAllEmployees();
    case "getAllUpdates":    return getAllUpdates();
    case "editUpdate":       return editUpdate(p.data);
    case "editEmployeeInfo": return editEmployeeInfo(p.userId, p.data);
    case "inviteEmployee":   return inviteEmployee(p.data);
    default:
      return { success: false, error: "Unknown action: " + p.action };
  }
}

// ────────────────────────────────────────────────────────────
// Apps Script bridge — for email side-effects only
// ────────────────────────────────────────────────────────────
// Returns { ok: true } or { ok: false, error }. Callers that the user is
// waiting on (invite) surface this; fire-and-forget callers just log it.
async function notifyAppsScript(payload) {
  if (!APPS_SCRIPT_URL) {
    const error = "Email service is not configured (APPS_SCRIPT_URL is unset).";
    console.error(error, "action:", payload.action);
    return { ok: false, error };
  }
  try {
    // Apps Script /exec answers with a 302 to script.googleusercontent.com;
    // fetch follows it and the body there is doPost's JSON result.
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      const error = `Email service returned HTTP ${res.status}.`;
      console.error("Apps Script bridge failed:", error, text.slice(0, 200));
      return { ok: false, error };
    }
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON = script error page */ }
    if (!json) {
      const error = "Email service returned an unexpected response.";
      console.error("Apps Script bridge failed:", error, text.slice(0, 200));
      return { ok: false, error };
    }
    if (json.success === false) {
      console.error("Apps Script bridge failed:", json.error);
      return { ok: false, error: json.error || "Email service error." };
    }
    return { ok: true, result: json };
  } catch (e) {
    console.error("Apps Script bridge failed:", e.message);
    return { ok: false, error: e.message };
  }
}

// ────────────────────────────────────────────────────────────
// Users / auth
// ────────────────────────────────────────────────────────────
async function login({ email, password }) {
  const rows = await sql`
    SELECT id, email, name, role, visa_type AS "visaType"
    FROM users
    WHERE LOWER(email) = LOWER(${(email || "").trim()})
      AND password = ${password}
    LIMIT 1
  `;
  if (!rows.length) return { success: false, error: "Invalid credentials." };
  return { success: true, user: rows[0] };
}

async function getAllUsers() {
  const rows = await sql`
    SELECT id, email, password, name, role, visa_type AS "visaType"
    FROM users
    ORDER BY created_at
  `;
  return { success: true, data: rows };
}

async function createUser(data) {
  const email = (data.email || "").toLowerCase().trim();
  const dup = await sql`SELECT 1 FROM users WHERE LOWER(email) = ${email} LIMIT 1`;
  if (dup.length)
    return { success: false, error: "A user with this email already exists." };

  const id = shortId("u_", 10);
  await sql`
    INSERT INTO users (id, email, password, name, role, visa_type)
    VALUES (${id}, ${data.email}, ${data.password}, ${data.name}, ${data.role}, ${data.visaType || null})
  `;
  return { success: true, id };
}

async function deleteUser(userId) {
  const result = await sql`DELETE FROM users WHERE id = ${userId} RETURNING id`;
  if (!result.length) return { success: false, error: "User not found." };
  return { success: true };
}

async function getManagers() {
  const rows = await sql`
    SELECT id, name, email FROM users WHERE role = 'manager' ORDER BY name
  `;
  return { success: true, data: rows };
}

// ────────────────────────────────────────────────────────────
// Invite (creates user + forwards to Apps Script for welcome email)
// ────────────────────────────────────────────────────────────
async function inviteEmployee(data) {
  const email = (data.email || "").toLowerCase().trim();
  const dup = await sql`SELECT 1 FROM users WHERE LOWER(email) = ${email} LIMIT 1`;
  if (dup.length)
    return { success: false, error: "An account with this email already exists." };

  const firstName  = (data.name || "user").split(" ")[0];
  const randDigits = Math.floor(1000 + Math.random() * 9000);
  const password   = `${firstName}@${randDigits}`;
  const userId     = shortId("u_", 8);

  await sql`
    INSERT INTO users (id, email, password, name, role, visa_type)
    VALUES (${userId}, ${data.email}, ${password}, ${data.name}, 'employee', ${data.visaType || null})
  `;

  const mail = await notifyAppsScript({
    action: "sendInviteEmail",
    data: { ...data, email: data.email, password, userId },
  });

  // The account exists either way — report the email outcome honestly so the
  // manager knows whether to hand over the credentials another way.
  return mail.ok
    ? { success: true, emailSent: true }
    : { success: true, emailSent: false, emailError: mail.error, password };
}

// ────────────────────────────────────────────────────────────
// Profiles
// ────────────────────────────────────────────────────────────
async function getProfile(userId) {
  const rows = await sql`SELECT data FROM profiles WHERE user_id = ${userId} LIMIT 1`;
  return { success: true, data: rows.length ? rows[0].data : {} };
}

async function saveProfile(userId, data) {
  await sql`
    INSERT INTO profiles (user_id, data, updated_at)
    VALUES (${userId}, ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
  `;
  if (data?.visaType === "H1B" && data?.h1bExpiry) {
    await notifyAppsScript({ action: "checkH1BExpiryForUser", userId, data });
  }
  return { success: true };
}

async function editEmployeeInfo(userId, data) {
  return saveProfile(userId, data);
}

// ────────────────────────────────────────────────────────────
// Weekly (STEM OPT)
// ────────────────────────────────────────────────────────────
async function getWeekly(employeeId) {
  const rows = await sql`
    SELECT data FROM weekly WHERE employee_id = ${employeeId} ORDER BY submitted_at
  `;
  return { success: true, data: rows.map(r => r.data) };
}

async function submitWeekly(data) {
  const id  = shortId("w_", 16);
  const now = new Date().toISOString();
  const row = { ...data, id, submittedAt: now, type: "weekly" };

  await sql`
    INSERT INTO weekly (id, employee_id, employee_name, week, data, submitted_at, reviewed)
    VALUES (${id}, ${data.employeeId}, ${data.employeeName}, ${data.week},
            ${JSON.stringify(row)}::jsonb, ${now}, FALSE)
  `;

  if (data.supportNeeded) {
    await notifyAppsScript({ action: "sendSupportEmail", data });
  }

  const countRows = await sql`
    SELECT COUNT(*)::int AS c FROM weekly WHERE employee_id = ${data.employeeId}
  `;
  const count = countRows[0]?.c || 0;
  if (count > 0 && count % 4 === 0) {
    await notifyAppsScript({ action: "sendFourthWeekEmail", data, count });
  }

  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Monthly (H-1B)
// ────────────────────────────────────────────────────────────
async function getMonthly(employeeId) {
  const rows = await sql`
    SELECT data FROM monthly WHERE employee_id = ${employeeId} ORDER BY submitted_at
  `;
  return { success: true, data: rows.map(r => r.data) };
}

async function submitMonthly(data) {
  const id  = shortId("m_", 16);
  const now = new Date().toISOString();
  const row = { ...data, id, submittedAt: now, type: "monthly" };

  await sql`
    INSERT INTO monthly (id, employee_id, employee_name, month, data, submitted_at, reviewed)
    VALUES (${id}, ${data.employeeId}, ${data.employeeName}, ${data.month},
            ${JSON.stringify(row)}::jsonb, ${now}, FALSE)
  `;

  if (data.supportNeeded) {
    await notifyAppsScript({ action: "sendSupportEmail", data });
  }

  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Manager dashboard
// ────────────────────────────────────────────────────────────
async function getAllEmployees() {
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.role, u.visa_type AS "visaType",
           COALESCE(p.data, '{}'::jsonb) AS profile
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.role = 'employee'
    ORDER BY u.name
  `;
  return { success: true, data: rows };
}

async function getAllUpdates() {
  const [weekly, monthly, employees] = await Promise.all([
    sql`SELECT data FROM weekly  ORDER BY submitted_at`,
    sql`SELECT data FROM monthly ORDER BY submitted_at`,
    getAllEmployees(),
  ]);
  const data = [
    ...weekly.map(r  => ({ ...r.data, type: "weekly"  })),
    ...monthly.map(r => ({ ...r.data, type: "monthly" })),
  ];
  return { success: true, data, employees: employees.data };
}

async function editUpdate(data) {
  // Try weekly first
  const w = await sql`SELECT data FROM weekly WHERE id = ${data.id} LIMIT 1`;
  if (w.length) {
    const merged = {
      ...w[0].data,
      managerComment:    data.managerComment,
      reviewedByManager: data.reviewedByManager,
    };
    await sql`
      UPDATE weekly
      SET data = ${JSON.stringify(merged)}::jsonb,
          reviewed = ${!!data.reviewedByManager}
      WHERE id = ${data.id}
    `;
    return { success: true };
  }
  const m = await sql`SELECT data FROM monthly WHERE id = ${data.id} LIMIT 1`;
  if (m.length) {
    const merged = {
      ...m[0].data,
      managerComment:    data.managerComment,
      reviewedByManager: data.reviewedByManager,
    };
    await sql`
      UPDATE monthly
      SET data = ${JSON.stringify(merged)}::jsonb,
          reviewed = ${!!data.reviewedByManager}
      WHERE id = ${data.id}
    `;
    return { success: true };
  }
  return { success: false, error: "Update not found." };
}
