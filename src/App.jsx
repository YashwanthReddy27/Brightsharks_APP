import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbzeXZWD3CBa-KTVofrWg6bixBsyYDfJQfy4pLzgjVUUxCQZgVWsCifYf2bZCRybdN97/exec";
const DEMO_MODE = API_URL.includes("YOUR_DEPLOYMENT_ID");

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const api = async (payload) => {
  if (DEMO_MODE) return demoHandler(payload);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
    return res.json();
  } catch { return { success: false, error: "Network error" }; }
};

const fmt = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const addMonths = (dateStr, months) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};
const getWeekNum = (d = new Date()) => {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-W${String(Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)).padStart(2, "0")}`;
};
const daysUntil = (dateStr) => {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ─── DEMO DATA ───────────────────────────────────────────────────────────────
const DEMO_USERS = [
  { id: "u1", email: "priya@company.com",   password: "pass123",    name: "Priya Sharma", role: "employee", visaType: "STEM_OPT" },
  { id: "u2", email: "raj@company.com",     password: "pass123",    name: "Raj Kumar",    role: "employee", visaType: "H1B" },
  { id: "u3", email: "ankit@company.com",   password: "manager123", name: "Ankit Patel",  role: "manager",  visaType: null },
  { id: "u4", email: "alice@company.com",   password: "manager123", name: "Alice Johnson",role: "manager",  visaType: null },
];
const DEMO_PROFILES = {
  u1: {
    clientName: "Acme Corp", clientManager: "Sarah Lee", teamLead: "John Doe",
    role: "Software Engineer", currentProjects: "Platform migration",
    visaType: "STEM_OPT", stemOptStart: "2024-06-01",
    stemMilestones: { "6m": "2024-12-01", "12m": "2025-06-01", "18m": "2025-12-01", "24m": "2026-06-01" },
    brightsharksManager: "Alice Johnson",
    i983: { studentName: "Priya Sharma", dso: "Univ DSO", employer: "Acme Corp", trainingPlan: "Full Stack Dev", goals: "Build scalable APIs", employerOversight: "Monthly check-ins", additionalRemarks: "" },
  },
  u2: {
    clientName: "Beta Inc", clientManager: "Tom Brown", teamLead: "Lisa Park",
    role: "Data Analyst", currentProjects: "BI Dashboard",
    visaType: "H1B", h1bStart: "2023-10-01", h1bExpiry: "2026-10-01",
    brightsharksManager: "Bob Smith",
    lcaJobDuties: "Analyze large datasets, build dashboards, create reports using Python and SQL.",
  },
};
const DEMO_WEEKLY = [];
const DEMO_MONTHLY = [];

function demoHandler(p) {
  const { action, data } = p;
  if (action === "login") {
    const u = DEMO_USERS.find(u => u.email === data.email && u.password === data.password);
    return u ? { success: true, user: u } : { success: false, error: "Invalid credentials" };
  }
  if (action === "getManagers") return { success: true, data: DEMO_USERS.filter(u => u.role === "manager").map(u => ({ id: u.id, name: u.name, email: u.email })) };
  if (action === "inviteEmployee") {
    const exists = DEMO_USERS.find(u => u.email === data.email);
    if (exists) return { success: false, error: "An account with this email already exists." };
    const newUser = { id: "u_" + Date.now(), email: data.email, password: data.name.split(" ")[0] + "@1234", name: data.name, role: "employee", visaType: data.visaType };
    DEMO_USERS.push(newUser);
    return { success: true };
  }
  if (action === "getAllUsers") return { success: true, data: DEMO_USERS.map(u => ({ ...u })) };
  if (action === "createUser") {
    if (DEMO_USERS.find(u => u.email === data.email)) return { success: false, error: "Email already exists." };
    const newUser = { id: "u" + Date.now(), ...data };
    DEMO_USERS.push(newUser);
    return { success: true, id: newUser.id };
  }
  if (action === "deleteUser") {
    const idx = DEMO_USERS.findIndex(u => u.id === p.userId);
    if (idx !== -1) DEMO_USERS.splice(idx, 1);
    return { success: true };
  }
  if (action === "getProfile") return { success: true, data: DEMO_PROFILES[p.userId] || {} };
  if (action === "saveProfile") { DEMO_PROFILES[p.userId] = { ...(DEMO_PROFILES[p.userId] || {}), ...p.data }; return { success: true }; }
  if (action === "getWeekly") return { success: true, data: DEMO_WEEKLY.filter(w => w.employeeId === p.employeeId) };
  if (action === "submitWeekly") { DEMO_WEEKLY.push({ ...data, id: Date.now(), submittedAt: new Date().toISOString() }); return { success: true }; }
  if (action === "getMonthly") return { success: true, data: DEMO_MONTHLY.filter(m => m.employeeId === p.employeeId) };
  if (action === "submitMonthly") { DEMO_MONTHLY.push({ ...data, id: Date.now(), submittedAt: new Date().toISOString() }); return { success: true }; }
  if (action === "getAllEmployees") return { success: true, data: DEMO_USERS.filter(u => u.role === "employee").map(u => ({ ...u, profile: DEMO_PROFILES[u.id] || {} })) };
  if (action === "getAllUpdates") {
    const employees = DEMO_USERS.filter(u => u.role === "employee");
    return { success: true, data: [...DEMO_WEEKLY.map(w => ({ ...w, type: "weekly" })), ...DEMO_MONTHLY.map(m => ({ ...m, type: "monthly" }))], employees };
  }
  if (action === "editUpdate") {
    const idx = DEMO_WEEKLY.findIndex(w => w.id === data.id);
    if (idx !== -1) { const orig = DEMO_WEEKLY[idx]; DEMO_WEEKLY[idx] = { ...orig, ...data, submittedAt: orig.submittedAt }; }
    return { success: true };
  }
  if (action === "editEmployeeInfo") { DEMO_PROFILES[p.userId] = { ...(DEMO_PROFILES[p.userId] || {}), ...p.data }; return { success: true }; }
  return { success: false, error: "Unknown action" };
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0c0d10; --surface: #13141a; --surface2: #1a1b24; --border: #252630;
  --accent: #6c8fff; --accent2: #ff8c42; --accent3: #4ecca3;
  --text: #edeef5; --muted: #6b6d7f; --danger: #ff5757; --warn: #ffbe3d;
  --success: #4ecca3; --stem: #6c8fff; --h1b: #ff8c42;
  --r: 10px; --rL: 16px;
}
body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.6; }
.app { min-height: 100vh; }

/* ── LOGIN ── */
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse 80% 60% at 50% 0%, #161b30 0%, #0c0d10 60%); }
.login-card { width: 420px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--rL); padding: 48px 40px; }
.login-logo { font-family: 'Syne', sans-serif; font-size: 1.8rem; font-weight: 800; color: var(--accent); letter-spacing: -0.5px; margin-bottom: 4px; }
.login-sub { color: var(--muted); font-size: 13px; margin-bottom: 36px; }
.field { margin-bottom: 18px; }
.field label { display: block; font-size: 12px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 7px; }
.field input, .field select, .field textarea { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r); padding: 10px 14px; color: var(--text); font-family: inherit; font-size: 14px; transition: border-color .2s; outline: none; resize: vertical; }
.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); }
.field textarea { min-height: 90px; }
.field select option { background: var(--bg); }
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: var(--r); border: none; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: #8aabff; }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn-danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
.btn-sm { padding: 6px 14px; font-size: 12px; }
.btn-full { width: 100%; justify-content: center; }
.demo-hint { background: #1a1b24; border: 1px solid var(--border); border-radius: var(--r); padding: 14px; margin-top: 20px; font-size: 12px; color: var(--muted); }
.demo-hint strong { color: var(--accent); }
.demo-hint p { margin-bottom: 4px; }

/* ── SHELL ── */
.shell { display: flex; min-height: 100vh; }
.sidebar { width: 220px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 24px 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.sidebar-logo { font-family: 'Syne', sans-serif; font-size: 1.2rem; font-weight: 800; color: var(--accent); padding: 0 20px 24px; letter-spacing: -0.5px; }
.sidebar-section { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); padding: 16px 20px 8px; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 20px; cursor: pointer; color: var(--muted); font-size: 13px; font-weight: 500; border-left: 2px solid transparent; transition: all .15s; }
.nav-item:hover { color: var(--text); background: var(--surface2); }
.nav-item.active { color: var(--accent); border-left-color: var(--accent); background: rgba(108,143,255,.07); }
.nav-item svg { width: 16px; height: 16px; flex-shrink: 0; }
.sidebar-spacer { flex: 1; }
.sidebar-user { padding: 16px 20px; border-top: 1px solid var(--border); }
.sidebar-user-name { font-weight: 600; font-size: 13px; }
.sidebar-user-email { font-size: 11px; color: var(--muted); }
.sidebar-user-badge { display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 20px; }
.badge-stem { background: rgba(108,143,255,.15); color: var(--stem); }
.badge-h1b { background: rgba(255,140,66,.15); color: var(--h1b); }
.badge-manager { background: rgba(78,204,163,.15); color: var(--accent3); }
.main { flex: 1; padding: 32px 40px; overflow-y: auto; }
.page-title { font-family: 'Syne', sans-serif; font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; }
.page-sub { color: var(--muted); font-size: 13px; margin-bottom: 28px; }

/* ── CARDS ── */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--rL); padding: 24px; margin-bottom: 20px; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.card-title { font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 700; }
.card-sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.col-span-2 { grid-column: span 2; }

/* ── MILESTONE CHIPS ── */
.milestones { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.milestone { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px; flex: 1; min-width: 130px; }
.milestone-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent); margin-bottom: 4px; }
.milestone-date { font-size: 13px; font-weight: 600; }
.milestone-days { font-size: 11px; color: var(--muted); margin-top: 2px; }
.milestone-days.warn { color: var(--warn); }
.milestone-days.past { color: var(--muted); text-decoration: line-through; }

/* ── ALERTS ── */
.alert { border-radius: var(--r); padding: 12px 16px; margin-bottom: 16px; font-size: 13px; }
.alert-success { background: rgba(78,204,163,.1); border: 1px solid rgba(78,204,163,.3); color: var(--success); }
.alert-error { background: rgba(255,87,87,.1); border: 1px solid rgba(255,87,87,.3); color: var(--danger); }
.alert-warn { background: rgba(255,190,61,.1); border: 1px solid rgba(255,190,61,.3); color: var(--warn); }
.alert-info { background: rgba(108,143,255,.1); border: 1px solid rgba(108,143,255,.3); color: var(--accent); }

/* ── EVALUATION FORM ── */
.eval-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.week-badge { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: var(--accent); }
.rating-group { margin-bottom: 20px; }
.rating-label { font-size: 13px; font-weight: 500; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
.rating-stars { display: flex; gap: 6px; }
.star { width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface2); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: all .15s; }
.star:hover, .star.active { background: var(--accent); border-color: var(--accent); }
.support-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.toggle-yes-no { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.toggle-yes-no button { padding: 8px 20px; border: none; background: transparent; color: var(--muted); font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s; }
.toggle-yes-no button.active-yes { background: rgba(78,204,163,.2); color: var(--success); }
.toggle-yes-no button.active-no { background: rgba(255,87,87,.1); color: var(--muted); }

/* ── UPDATE HISTORY ── */
.update-list { display: flex; flex-direction: column; gap: 12px; }
.update-item { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r); padding: 16px; }
.update-item-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.update-week { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; }
.update-date { font-size: 11px; color: var(--muted); }
.update-field { margin-bottom: 8px; }
.update-field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 3px; }
.update-field-value { font-size: 13px; }

/* ── MANAGER DASHBOARD ── */
.employee-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r); padding: 18px; }
.employee-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; }
.employee-meta { font-size: 12px; color: var(--muted); margin-top: 3px; }
.employees-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.status-green { background: var(--success); }
.status-orange { background: var(--warn); }
.status-red { background: var(--danger); }
.tab-bar { display: flex; gap: 4px; margin-bottom: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 4px; width: fit-content; }
.tab { padding: 7px 18px; border-radius: 7px; border: none; background: transparent; color: var(--muted); font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s; }
.tab.active { background: var(--accent); color: #fff; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); padding: 10px 14px; border-bottom: 1px solid var(--border); }
.table td { padding: 12px 14px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: top; }
.table tr:last-child td { border-bottom: none; }
.table tr:hover td { background: rgba(255,255,255,.02); }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.chip-stem { background: rgba(108,143,255,.15); color: var(--stem); }
.chip-h1b { background: rgba(255,140,66,.15); color: var(--h1b); }
.chip-pending { background: rgba(255,190,61,.15); color: var(--warn); }
.chip-done { background: rgba(78,204,163,.15); color: var(--success); }

/* ── SEARCH ── */
.search-row { display: flex; gap: 12px; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; }
.search-row .field { margin-bottom: 0; }
.search-row input, .search-row select { min-width: 180px; }

/* ── DATE SEARCH ── */
.date-search { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r); padding: 16px; margin-bottom: 20px; display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }

/* ── MODAL ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--rL); padding: 28px; width: 560px; max-width: 100%; max-height: 90vh; overflow-y: auto; }
.modal-title { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

/* ── SECTION DIVIDER ── */
.section-divider { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
.section-heading { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }

/* ── SPINNER ── */
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.2); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── EXPIRY WARNING ── */
.expiry-banner { background: rgba(255,87,87,.08); border: 1px solid rgba(255,87,87,.3); border-radius: var(--r); padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; font-size: 13px; }
.expiry-icon { font-size: 18px; }

/* ── RESPONSIVE ── */
@media (max-width: 768px) {
  .sidebar { display: none; }
  .main { padding: 20px; }
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .col-span-2 { grid-column: span 1; }
}
`;

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = {
  Profile: () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  Update: () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 12h6M9 16h4M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z"/></svg>,
  Team: () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Reviews: () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  Logout: () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>,
  Users: () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 4a4 4 0 100 8 4 4 0 000-8zM4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M20 8v6M17 11h6" strokeLinecap="round"/></svg>,
  Calendar: () => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
};

// ─── STAR RATING ─────────────────────────────────────────────────────────────
function StarRating({ label, value, onChange, max = 5 }) {
  return (
    <div className="rating-group">
      <div className="rating-label">{label}</div>
      <div className="rating-stars">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`star${i < value ? " active" : ""}`} onClick={() => onChange(i + 1)}>
            {i < value ? "★" : "☆"}
          </div>
        ))}
        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>{value}/{max}</span>
      </div>
    </div>
  );
}

// ─── SUPPORT TOGGLE ──────────────────────────────────────────────────────────
function SupportToggle({ value, onChange }) {
  return (
    <div>
      <div className="support-row">
        <label style={{ fontSize: 13, fontWeight: 500 }}>Support Needed?</label>
        <div className="toggle-yes-no">
          <button className={value ? "active-yes" : ""} onClick={() => onChange(true)}>Yes</button>
          <button className={!value ? "active-no" : ""} onClick={() => onChange(false)}>No</button>
        </div>
      </div>
      {value && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>Describe the support needed</label>
          <textarea placeholder="Please describe what support you need..." />
        </div>
      )}
    </div>
  );
}

// ─── MILESTONES DISPLAY ──────────────────────────────────────────────────────
function StemMilestones({ stemOptStart }) {
  if (!stemOptStart) return null;
  const milestones = [
    { label: "6 Months",  date: addMonths(stemOptStart, 6) },
    { label: "12 Months", date: addMonths(stemOptStart, 12) },
    { label: "18 Months", date: addMonths(stemOptStart, 18) },
    { label: "24 Months", date: addMonths(stemOptStart, 24) },
  ];
  return (
    <div className="milestones">
      {milestones.map(m => {
        const days = daysUntil(m.date);
        const cls = days < 0 ? "past" : days < 90 ? "warn" : "";
        return (
          <div className="milestone" key={m.label}>
            <div className="milestone-label">{m.label}</div>
            <div className="milestone-date">{fmt(m.date)}</div>
            <div className={`milestone-days ${cls}`}>
              {days < 0 ? `${Math.abs(days)} days ago` : `${days} days left`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── EMPLOYEE PROFILE ────────────────────────────────────────────────────────
function EmployeeProfile({ user }) {
  const [profile, setProfile] = useState({
    clientName: "", clientManager: "", teamLead: "", role: "",
    currentProjects: "", visaType: user.visaType || "",
    stemOptStart: "", brightsharksManager: "", brightsharksManagerEmail: "",
    h1bStart: "", h1bExpiry: "", lcaJobDuties: "",
    i983: { studentName: user.name, dso: "", employer: "", trainingPlan: "", goals: "", employerOversight: "", additionalRemarks: "" },
  });
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    Promise.all([
      api({ action: "getProfile", userId: user.id }),
      api({ action: "getManagers" }),
    ]).then(([profRes, mgrRes]) => {
      if (profRes.success && profRes.data) setProfile(p => ({ ...p, ...profRes.data, i983: { ...p.i983, ...(profRes.data.i983 || {}) } }));
      if (mgrRes.success) setManagers(mgrRes.data);
      setLoading(false);
    });
  }, [user.id]);

  // When manager is selected, also store their email for backend routing
  const selectManager = (managerId) => {
    const mgr = managers.find(m => m.id === managerId);
    setProfile(p => ({ ...p, brightsharksManager: mgr ? mgr.name : "", brightsharksManagerId: managerId, brightsharksManagerEmail: mgr ? mgr.email : "" }));
  };

  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));
  const setI983 = (k, v) => setProfile(p => ({ ...p, i983: { ...p.i983, [k]: v } }));

  const save = async () => {
    setSaving(true); setMsg(null);
    const res = await api({ action: "saveProfile", userId: user.id, data: profile });
    setSaving(false);
    setMsg(res.success ? { type: "success", text: "Profile saved successfully." } : { type: "error", text: res.error || "Failed to save." });
  };

  const stemOptStart = profile.stemOptStart;
  const visaType = profile.visaType || user.visaType;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;

  const h1bExpiry = profile.h1bExpiry;
  const daysToExpiry = h1bExpiry ? daysUntil(h1bExpiry) : null;

  return (
    <div>
      <div className="page-title">My Profile</div>
      <div className="page-sub">Keep your details up to date</div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {visaType === "H1B" && daysToExpiry !== null && daysToExpiry <= 180 && (
        <div className="expiry-banner">
          <span className="expiry-icon">⚠️</span>
          <span>Your H-1B expires on <strong>{fmt(h1bExpiry)}</strong> — only <strong>{daysToExpiry} days</strong> remaining. Your HR and manager have been notified.</span>
        </div>
      )}

      {/* ── Basic Info ── */}
      <div className="card">
        <div className="card-header"><div><div className="card-title">Basic Information</div></div></div>
        <div className="grid-2">
          <div className="field"><label>Client Name</label><input value={profile.clientName} onChange={e => set("clientName", e.target.value)} /></div>
          <div className="field"><label>Client Manager</label><input value={profile.clientManager} onChange={e => set("clientManager", e.target.value)} /></div>
          <div className="field"><label>Team Lead</label><input value={profile.teamLead} onChange={e => set("teamLead", e.target.value)} /></div>
          <div className="field"><label>Role / Title</label><input value={profile.role} onChange={e => set("role", e.target.value)} /></div>
          <div className="field col-span-2"><label>Current Projects</label><input value={profile.currentProjects} onChange={e => set("currentProjects", e.target.value)} /></div>
          <div className="field">
            <label>Visa Type</label>
            <select value={profile.visaType} onChange={e => set("visaType", e.target.value)}>
              <option value="">Select...</option>
              <option value="STEM_OPT">STEM OPT</option>
              <option value="H1B">H-1B</option>
              <option value="GC">Green Card</option>
              <option value="USC">US Citizen</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="field">
            <label>BrightSharks Manager</label>
            <select value={profile.brightsharksManagerId || ""} onChange={e => selectManager(e.target.value)}>
              <option value="">Select your manager...</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {profile.brightsharksManager && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
                ✓ Assigned: <strong style={{ color: "var(--accent3)" }}>{profile.brightsharksManager}</strong> — evaluations & alerts will be sent to them
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STEM OPT Section ── */}
      {visaType === "STEM_OPT" && (
        <>
          <div className="card">
            <div className="card-header"><div><div className="card-title">STEM OPT Details</div><div className="card-sub">Auto-calculates evaluation milestones</div></div></div>
            <div className="grid-2">
              <div className="field">
                <label>STEM OPT Start Date</label>
                <input type="date" value={profile.stemOptStart} onChange={e => set("stemOptStart", e.target.value)} />
              </div>
            </div>
            {stemOptStart && (
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>EVALUATION MILESTONES</div>
                <StemMilestones stemOptStart={stemOptStart} />
              </div>
            )}
          </div>

          {/* ── I-983 Form ── */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">I-983 Training Plan</div>
                <div className="card-sub">Form I-983 — STEM OPT Training Plan for STEM Students</div>
              </div>
            </div>
            <div className="section-heading">Part 1 — Student Information</div>
            <div className="grid-2">
              <div className="field"><label>Student Full Name</label><input value={profile.i983.studentName} onChange={e => setI983("studentName", e.target.value)} /></div>
              <div className="field"><label>DSO Name</label><input value={profile.i983.dso} onChange={e => setI983("dso", e.target.value)} /></div>
              <div className="field col-span-2"><label>Employer / Company</label><input value={profile.i983.employer} onChange={e => setI983("employer", e.target.value)} /></div>
            </div>
            <div className="section-heading" style={{ marginTop: 20 }}>Part 2 — Training Plan</div>
            <div className="field"><label>Training Plan Description</label><textarea value={profile.i983.trainingPlan} onChange={e => setI983("trainingPlan", e.target.value)} placeholder="Describe the technical skills and knowledge to be gained..." /></div>
            <div className="section-heading" style={{ marginTop: 20 }}>Part 3 — Goals & Objectives</div>
            <div className="field"><label>Goals and Objectives</label><textarea value={profile.i983.goals} onChange={e => setI983("goals", e.target.value)} placeholder="Specific goals and measurable objectives..." /></div>
            <div className="section-heading" style={{ marginTop: 20 }}>Part 4 — Employer Oversight</div>
            <div className="field"><label>Employer Oversight Plan</label><textarea value={profile.i983.employerOversight} onChange={e => setI983("employerOversight", e.target.value)} placeholder="How will the employer supervise and evaluate the student..." /></div>
            <div className="section-heading" style={{ marginTop: 20 }}>Additional Remarks</div>
            <div className="field"><label>Additional Remarks</label><textarea value={profile.i983.additionalRemarks} onChange={e => setI983("additionalRemarks", e.target.value)} placeholder="Any additional information..." /></div>
          </div>
        </>
      )}

      {/* ── H-1B Section ── */}
      {visaType === "H1B" && (
        <div className="card">
          <div className="card-header"><div><div className="card-title">H-1B Details</div><div className="card-sub">Email alert sent to HR & Manager 6 months before expiry</div></div></div>
          <div className="grid-2">
            <div className="field"><label>H-1B Start Date</label><input type="date" value={profile.h1bStart} onChange={e => set("h1bStart", e.target.value)} /></div>
            <div className="field"><label>H-1B Expiration Date</label><input type="date" value={profile.h1bExpiry} onChange={e => set("h1bExpiry", e.target.value)} /></div>
          </div>
          {profile.h1bExpiry && (
            <div style={{ marginTop: 8 }}>
              {daysToExpiry !== null && daysToExpiry > 0 && (
                <div className={`alert ${daysToExpiry <= 180 ? "alert-warn" : "alert-info"}`}>
                  H-1B expires in <strong>{daysToExpiry} days</strong> ({fmt(profile.h1bExpiry)}).
                  {daysToExpiry <= 180 && " ⚠️ Alert has been sent to HR and your manager."}
                </div>
              )}
            </div>
          )}
          <div className="field" style={{ marginTop: 16 }}>
            <label>LCA Job Duties</label>
            <textarea value={profile.lcaJobDuties} onChange={e => set("lcaJobDuties", e.target.value)} placeholder="Enter the job duties as described in the Labor Condition Application (LCA)..." style={{ minHeight: 120 }} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : "Save Profile"}
        </button>
      </div>
    </div>
  );
}

// ─── STEM WEEKLY EVALUATION ───────────────────────────────────────────────────
function StemEvaluation({ user }) {
  const week = getWeekNum();
  const [form, setForm] = useState({
    technicalSkills: 0, communication: 0, teamwork: 0, deliverables: 0,
    tasksCompleted: "", goalsObjectives: "", employerOversight: "", additionalRemarks: "",
    supportNeeded: false, supportMessage: "",
  });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api({ action: "getWeekly", employeeId: user.id }).then(res => {
      if (res.success) setHistory(res.data.sort((a, b) => b.week > a.week ? 1 : -1).slice(0, 4));
    });
  }, [user.id]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.tasksCompleted) return setMsg({ type: "error", text: "Please fill in Tasks Completed." });
    setSaving(true); setMsg(null);
    const res = await api({ action: "submitWeekly", data: { employeeId: user.id, employeeName: user.name, week, ...form } });
    setSaving(false);
    if (res.success) {
      setMsg({ type: "success", text: "Weekly evaluation submitted! Email sent to your manager." });
      const refresh = await api({ action: "getWeekly", employeeId: user.id });
      if (refresh.success) setHistory(refresh.data.sort((a, b) => b.week > a.week ? 1 : -1).slice(0, 4));
    } else setMsg({ type: "error", text: res.error || "Failed." });
  };

  const alreadySubmitted = history.some(h => h.week === week);

  return (
    <div>
      <div className="page-title">Weekly Evaluation</div>
      <div className="page-sub">STEM OPT — Submit your weekly self-evaluation</div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {alreadySubmitted && (
        <div className="alert alert-info">You've already submitted for this week ({week}). Below is your submission history.</div>
      )}

      {!alreadySubmitted && (
        <div className="card">
          <div className="eval-header">
            <div className="card-title">Week Evaluation</div>
            <div className="week-badge">📅 {week}</div>
          </div>

          <StarRating label="Technical Skills" value={form.technicalSkills} onChange={v => set("technicalSkills", v)} />
          <StarRating label="Communication" value={form.communication} onChange={v => set("communication", v)} />
          <StarRating label="Teamwork & Collaboration" value={form.teamwork} onChange={v => set("teamwork", v)} />
          <StarRating label="Deliverables Completion" value={form.deliverables} onChange={v => set("deliverables", v)} />

          <hr className="section-divider" />
          <div className="section-heading">Student Evaluation</div>

          <div className="field"><label>Tasks Completed This Week *</label><textarea value={form.tasksCompleted} onChange={e => set("tasksCompleted", e.target.value)} placeholder="Describe the tasks you completed..." /></div>
          <div className="field"><label>Goals & Objectives Progress</label><textarea value={form.goalsObjectives} onChange={e => set("goalsObjectives", e.target.value)} placeholder="How did you progress toward your training goals?" /></div>
          <div className="field"><label>Employer Oversight Activities</label><textarea value={form.employerOversight} onChange={e => set("employerOversight", e.target.value)} placeholder="Meetings, reviews, feedback sessions attended..." /></div>
          <div className="field"><label>Additional Remarks</label><textarea value={form.additionalRemarks} onChange={e => set("additionalRemarks", e.target.value)} placeholder="Any additional comments or observations..." /></div>

          <hr className="section-divider" />
          <SupportToggle value={form.supportNeeded} onChange={v => set("supportNeeded", v)} />
          {form.supportNeeded && (
            <div className="field" style={{ marginTop: 8 }}>
              <label>Support Details</label>
              <textarea value={form.supportMessage} onChange={e => set("supportMessage", e.target.value)} placeholder="Describe the support you need..." />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? <><span className="spinner" /> Submitting…</> : "Submit Evaluation"}
            </button>
          </div>
        </div>
      )}

      {/* History — last 4 */}
      {history.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Previous Evaluations</div>
            <div className="card-sub">Last {history.length} submissions</div>
          </div>
          <div className="update-list">
            {history.map((h, i) => (
              <div className="update-item" key={i}>
                <div className="update-item-header">
                  <div className="update-week">{h.week}</div>
                  <div className="update-date">{fmt(h.submittedAt)}</div>
                </div>
                <div className="update-field"><div className="update-field-label">Tasks Completed</div><div className="update-field-value">{h.tasksCompleted}</div></div>
                {h.goalsObjectives && <div className="update-field"><div className="update-field-label">Goals Progress</div><div className="update-field-value">{h.goalsObjectives}</div></div>}
                <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                  {["technicalSkills", "communication", "teamwork", "deliverables"].map(k => (
                    <div key={k} style={{ fontSize: 12 }}>
                      <span style={{ color: "var(--muted)" }}>{k.replace(/([A-Z])/g, " $1")}: </span>
                      <span style={{ color: "var(--accent)" }}>{"★".repeat(h[k] || 0)}{"☆".repeat(5 - (h[k] || 0))}</span>
                    </div>
                  ))}
                </div>
                {h.supportNeeded && <div className="chip chip-pending" style={{ marginTop: 8 }}>🆘 Support Requested</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── H1B MONTHLY EVALUATION ──────────────────────────────────────────────────
function H1BEvaluation({ user }) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [form, setForm] = useState({
    technicalSkills: 0, communication: 0, teamwork: 0, deliverables: 0,
    tasksCompleted: "", goalsObjectives: "", employerOversight: "", additionalRemarks: "",
    supportNeeded: false, supportMessage: "",
  });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api({ action: "getMonthly", employeeId: user.id }).then(res => {
      if (res.success) setHistory(res.data.sort((a, b) => b.month > a.month ? 1 : -1));
    });
  }, [user.id]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.tasksCompleted) return setMsg({ type: "error", text: "Please fill in Tasks Completed." });
    setSaving(true); setMsg(null);
    const res = await api({ action: "submitMonthly", data: { employeeId: user.id, employeeName: user.name, month, ...form } });
    setSaving(false);
    if (res.success) {
      setMsg({ type: "success", text: "Monthly evaluation submitted!" });
      const refresh = await api({ action: "getMonthly", employeeId: user.id });
      if (refresh.success) setHistory(refresh.data.sort((a, b) => b.month > a.month ? 1 : -1));
    } else setMsg({ type: "error", text: res.error || "Failed." });
  };

  const alreadySubmitted = history.some(h => h.month === month);

  return (
    <div>
      <div className="page-title">Monthly Evaluation</div>
      <div className="page-sub">H-1B — Submit your monthly self-evaluation</div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {alreadySubmitted && (
        <div className="alert alert-info">You've already submitted for this month ({month}).</div>
      )}

      {!alreadySubmitted && (
        <div className="card">
          <div className="eval-header">
            <div className="card-title">Monthly Evaluation</div>
            <div className="week-badge">📅 {month}</div>
          </div>

          <StarRating label="Technical Skills" value={form.technicalSkills} onChange={v => set("technicalSkills", v)} />
          <StarRating label="Communication" value={form.communication} onChange={v => set("communication", v)} />
          <StarRating label="Teamwork & Collaboration" value={form.teamwork} onChange={v => set("teamwork", v)} />
          <StarRating label="Deliverables Completion" value={form.deliverables} onChange={v => set("deliverables", v)} />

          <hr className="section-divider" />
          <div className="field"><label>Tasks Completed This Month *</label><textarea value={form.tasksCompleted} onChange={e => set("tasksCompleted", e.target.value)} placeholder="Describe tasks and achievements..." /></div>
          <div className="field"><label>Goals & Objectives Progress</label><textarea value={form.goalsObjectives} onChange={e => set("goalsObjectives", e.target.value)} placeholder="Progress toward your role objectives..." /></div>
          <div className="field"><label>Employer Oversight Activities</label><textarea value={form.employerOversight} onChange={e => set("employerOversight", e.target.value)} placeholder="Performance reviews, meetings, feedback sessions..." /></div>
          <div className="field"><label>Additional Remarks</label><textarea value={form.additionalRemarks} onChange={e => set("additionalRemarks", e.target.value)} placeholder="Any additional comments..." /></div>

          <hr className="section-divider" />
          <SupportToggle value={form.supportNeeded} onChange={v => set("supportNeeded", v)} />
          {form.supportNeeded && (
            <div className="field" style={{ marginTop: 8 }}>
              <label>Support Details</label>
              <textarea value={form.supportMessage} onChange={e => set("supportMessage", e.target.value)} placeholder="Describe the support you need..." />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? <><span className="spinner" /> Submitting…</> : "Submit Evaluation"}
            </button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Evaluation History</div>
          <div className="update-list">
            {history.map((h, i) => (
              <div className="update-item" key={i}>
                <div className="update-item-header">
                  <div className="update-week">{h.month}</div>
                  <div className="update-date">{fmt(h.submittedAt)}</div>
                </div>
                <div className="update-field"><div className="update-field-label">Tasks</div><div className="update-field-value">{h.tasksCompleted}</div></div>
                <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                  {["technicalSkills", "communication", "teamwork", "deliverables"].map(k => (
                    <div key={k} style={{ fontSize: 12 }}>
                      <span style={{ color: "var(--muted)" }}>{k.replace(/([A-Z])/g, " $1")}: </span>
                      <span style={{ color: "var(--h1b)" }}>{"★".repeat(h[k] || 0)}{"☆".repeat(5 - (h[k] || 0))}</span>
                    </div>
                  ))}
                </div>
                {h.supportNeeded && <div className="chip chip-pending" style={{ marginTop: 8 }}>🆘 Support Requested</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MANAGER: TEAM OVERVIEW ──────────────────────────────────────────────────
function ManagerTeam({ user }) {
  const [employees, setEmployees] = useState([]);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editProfile, setEditProfile] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Invite state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", visaType: "STEM_OPT" });
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);

  useEffect(() => {
    api({ action: "getAllEmployees" }).then(res => {
      if (res.success) setEmployees(res.data);
    });
  }, []);

  const openEdit = (emp) => {
    setEditingEmployee(emp);
    setEditProfile({ ...emp.profile });
    setMsg(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    const res = await api({ action: "editEmployeeInfo", userId: editingEmployee.id, data: editProfile });
    setSaving(false);
    if (res.success) {
      setEmployees(prev => prev.map(e => e.id === editingEmployee.id ? { ...e, profile: { ...e.profile, ...editProfile } } : e));
      setEditingEmployee(null);
    } else setMsg({ type: "error", text: res.error || "Failed." });
  };

  const sendInvite = async () => {
    if (!inviteForm.name || !inviteForm.email) return setInviteMsg({ type: "error", text: "Name and email are required." });
    setInviting(true); setInviteMsg(null);
    const res = await api({ action: "inviteEmployee", data: { ...inviteForm, invitedBy: user.name } });
    setInviting(false);
    if (res.success) {
      setInviteMsg({ type: "success", text: `Invite sent to ${inviteForm.email}!` });
      setInviteForm({ name: "", email: "", visaType: "STEM_OPT" });
      // Refresh employee list
      const refresh = await api({ action: "getAllEmployees" });
      if (refresh.success) setEmployees(refresh.data);
    } else {
      setInviteMsg({ type: "error", text: res.error || "Failed to send invite." });
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="page-title">Team Overview</div>
        <button className="btn btn-primary" onClick={() => { setShowInvite(true); setInviteMsg(null); }}>
          + Invite Employee
        </button>
      </div>
      <div className="page-sub" style={{ marginBottom: 28 }}>{employees.length} team members</div>

      <div className="employees-grid">
        {employees.map(emp => {
          const p = emp.profile || {};
          const visaType = p.visaType || emp.visaType;
          return (
            <div className="employee-card" key={emp.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="employee-name">{emp.name}</div>
                  <div className="employee-meta">{p.role || "—"} · {p.clientName || "—"}</div>
                  <div style={{ marginTop: 8 }}>
                    {visaType === "STEM_OPT" && <span className="chip chip-stem">STEM OPT</span>}
                    {visaType === "H1B" && <span className="chip chip-h1b">H-1B</span>}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)}><Icon.Edit /> Edit</button>
              </div>
              {visaType === "STEM_OPT" && p.stemOptStart && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>STEM Milestones</div>
                  <StemMilestones stemOptStart={p.stemOptStart} />
                </div>
              )}
              {visaType === "H1B" && p.h1bExpiry && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>H-1B Expiry: <span style={{ color: daysUntil(p.h1bExpiry) <= 180 ? "var(--warn)" : "var(--text)" }}>{fmt(p.h1bExpiry)}</span></div>
                  {p.lcaJobDuties && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>LCA: {p.lcaJobDuties.slice(0, 80)}…</div>}
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>BrightSharks Mgr: {p.brightsharksManager || "—"}</div>
            </div>
          );
        })}
      </div>

      {editingEmployee && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingEmployee(null)}>
          <div className="modal">
            <div className="modal-title">Edit Employee: {editingEmployee.name}</div>
            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
            <div className="grid-2">
              <div className="field"><label>Client Name</label><input value={editProfile.clientName || ""} onChange={e => setEditProfile(p => ({ ...p, clientName: e.target.value }))} /></div>
              <div className="field"><label>Client Manager</label><input value={editProfile.clientManager || ""} onChange={e => setEditProfile(p => ({ ...p, clientManager: e.target.value }))} /></div>
              <div className="field"><label>Team Lead</label><input value={editProfile.teamLead || ""} onChange={e => setEditProfile(p => ({ ...p, teamLead: e.target.value }))} /></div>
              <div className="field"><label>Role</label><input value={editProfile.role || ""} onChange={e => setEditProfile(p => ({ ...p, role: e.target.value }))} /></div>
              <div className="field"><label>Visa Type</label>
                <select value={editProfile.visaType || ""} onChange={e => setEditProfile(p => ({ ...p, visaType: e.target.value }))}>
                  <option value="">Select…</option>
                  <option value="STEM_OPT">STEM OPT</option>
                  <option value="H1B">H-1B</option>
                  <option value="GC">Green Card</option>
                  <option value="USC">US Citizen</option>
                </select>
              </div>
              {(editProfile.visaType === "STEM_OPT") && (
                <div className="field col-span-2"><label>STEM OPT Start Date</label><input type="date" value={editProfile.stemOptStart || ""} onChange={e => setEditProfile(p => ({ ...p, stemOptStart: e.target.value }))} /></div>
              )}
              {(editProfile.visaType === "H1B") && (
                <>
                  <div className="field"><label>H-1B Start Date</label><input type="date" value={editProfile.h1bStart || ""} onChange={e => setEditProfile(p => ({ ...p, h1bStart: e.target.value }))} /></div>
                  <div className="field"><label>H-1B Expiry Date</label><input type="date" value={editProfile.h1bExpiry || ""} onChange={e => setEditProfile(p => ({ ...p, h1bExpiry: e.target.value }))} /></div>
                  <div className="field col-span-2"><label>LCA Job Duties</label><textarea value={editProfile.lcaJobDuties || ""} onChange={e => setEditProfile(p => ({ ...p, lcaJobDuties: e.target.value }))} /></div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditingEmployee(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal">
            <div className="modal-title">Invite New Employee</div>
            <div className="card-sub" style={{ marginBottom: 20 }}>They'll receive a welcome email with their login credentials.</div>
            {inviteMsg && <div className={`alert alert-${inviteMsg.type}`}>{inviteMsg.text}</div>}
            <div className="field">
              <label>Full Name</label>
              <input placeholder="e.g. Priya Sharma" value={inviteForm.name} onChange={e => setInviteForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="field">
              <label>Work Email</label>
              <input type="email" placeholder="priya@company.com" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="field">
              <label>Visa Type</label>
              <select value={inviteForm.visaType} onChange={e => setInviteForm(p => ({ ...p, visaType: e.target.value }))}>
                <option value="STEM_OPT">STEM OPT</option>
                <option value="H1B">H-1B</option>
                <option value="GC">Green Card</option>
                <option value="USC">US Citizen</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {inviteMsg?.type === "success" && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 12 }}>
                Employee has been added to the system and will receive their login details via email.
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowInvite(false)}>Close</button>
              <button className="btn btn-primary" onClick={sendInvite} disabled={inviting || inviteMsg?.type === "success"}>
                {inviting ? <><span className="spinner" /> Sending…</> : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MANAGER: REVIEWS ────────────────────────────────────────────────────────
function ManagerReviews() {
  const [tab, setTab] = useState("pending");
  const [updates, setUpdates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filterName, setFilterName] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api({ action: "getAllUpdates" }).then(res => {
      if (res.success) { setUpdates(res.data); setEmployees(res.employees || []); }
    });
  }, []);

  const filtered = updates.filter(u => {
    if (filterName && !u.employeeName?.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterType && u.type !== filterType) return false;
    const dateStr = u.submittedAt ? u.submittedAt.split("T")[0] : null;
    if (filterFrom && dateStr && dateStr < filterFrom) return false;
    if (filterTo && dateStr && dateStr > filterTo) return false;
    return true;
  });

  const pending = filtered.filter(u => !u.reviewedByManager);
  const reviewed = filtered.filter(u => u.reviewedByManager);
  const shown = tab === "pending" ? pending : reviewed;

  const openEdit = (u) => { setEditingUpdate(u); setEditData({ managerComment: u.managerComment || "" }); };

  const saveEdit = async () => {
    setSaving(true);
    const res = await api({ action: "editUpdate", data: { id: editingUpdate.id, managerComment: editData.managerComment, reviewedByManager: true } });
    setSaving(false);
    if (res.success) {
      setUpdates(prev => prev.map(u => u.id === editingUpdate.id ? { ...u, managerComment: editData.managerComment, reviewedByManager: true } : u));
      setEditingUpdate(null);
    }
  };

  return (
    <div>
      <div className="page-title">Evaluations</div>
      <div className="page-sub">Review and comment on employee evaluations</div>

      <div className="date-search">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Search by Name</label>
          <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Employee name…" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All</option>
            <option value="weekly">STEM Weekly</option>
            <option value="monthly">H-1B Monthly</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>From Date</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>To Date</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        </div>
        {(filterName || filterType || filterFrom || filterTo) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterName(""); setFilterType(""); setFilterFrom(""); setFilterTo(""); }}>Clear</button>
        )}
      </div>

      <div className="tab-bar">
        <button className={`tab${tab === "pending" ? " active" : ""}`} onClick={() => setTab("pending")}>
          Pending Review {pending.length > 0 && `(${pending.length})`}
        </button>
        <button className={`tab${tab === "reviewed" ? " active" : ""}`} onClick={() => setTab("reviewed")}>
          Reviewed ({reviewed.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
          {tab === "pending" ? "No pending evaluations 🎉" : "No reviewed evaluations yet"}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Period</th>
                <th>Submitted</th>
                <th>Ratings</th>
                <th>Support</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u, i) => (
                <tr key={i}>
                  <td><strong>{u.employeeName}</strong></td>
                  <td><span className={`chip ${u.type === "weekly" ? "chip-stem" : "chip-h1b"}`}>{u.type === "weekly" ? "STEM Weekly" : "H-1B Monthly"}</span></td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{u.week || u.month}</td>
                  <td style={{ fontSize: 12 }}>{fmt(u.submittedAt)}</td>
                  <td style={{ fontSize: 12 }}>
                    {["technicalSkills", "communication", "teamwork", "deliverables"].map(k => u[k] ? (
                      <div key={k} style={{ whiteSpace: "nowrap" }}>
                        <span style={{ color: "var(--muted)" }}>{k.replace(/([A-Z])/g, " $1").trim()}: </span>
                        <span style={{ color: "var(--accent)" }}>{"★".repeat(u[k] || 0)}</span>
                      </div>
                    ) : null)}
                  </td>
                  <td>
                    {u.supportNeeded
                      ? <span className="chip chip-pending">🆘 Yes</span>
                      : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                      <Icon.Edit /> {u.reviewedByManager ? "Edit" : "Review"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingUpdate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingUpdate(null)}>
          <div className="modal">
            <div className="modal-title">Review: {editingUpdate.employeeName} — {editingUpdate.week || editingUpdate.month}</div>
            <div style={{ marginBottom: 16 }}>
              <div className="update-field"><div className="update-field-label">Tasks Completed</div><div className="update-field-value">{editingUpdate.tasksCompleted}</div></div>
              {editingUpdate.goalsObjectives && <div className="update-field" style={{ marginTop: 10 }}><div className="update-field-label">Goals Progress</div><div className="update-field-value">{editingUpdate.goalsObjectives}</div></div>}
              {editingUpdate.additionalRemarks && <div className="update-field" style={{ marginTop: 10 }}><div className="update-field-label">Additional Remarks</div><div className="update-field-value">{editingUpdate.additionalRemarks}</div></div>}
              {editingUpdate.supportNeeded && (
                <div className="alert alert-warn" style={{ marginTop: 12 }}>🆘 Support requested: {editingUpdate.supportMessage}</div>
              )}
            </div>
            <div className="field">
              <label>Manager Comments</label>
              <textarea value={editData.managerComment} onChange={e => setEditData(p => ({ ...p, managerComment: e.target.value }))} placeholder="Add your review comments..." />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
              Note: Editing your comments will not change the employee's original submission date.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditingUpdate(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : "Save Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MANAGER: USER MANAGEMENT ────────────────────────────────────────────────
function ManagerUsers() {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]     = useState({ name: "", email: "", password: "", role: "employee", visaType: "STEM_OPT" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = () => {
    setLoading(true);
    api({ action: "getAllUsers" }).then(res => {
      if (res.success) setUsers(res.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addUser = async () => {
    if (!form.name || !form.email || !form.password) return setMsg({ type: "error", text: "Name, email and password are required." });
    setSaving(true); setMsg(null);
    const res = await api({ action: "createUser", data: form });
    setSaving(false);
    if (res.success) {
      setMsg({ type: "success", text: `${form.name} added successfully!` });
      setForm({ name: "", email: "", password: "", role: "employee", visaType: "STEM_OPT" });
      setShowAdd(false);
      load();
    } else setMsg({ type: "error", text: res.error || "Failed to create user." });
  };

  const deleteUser = async (userId) => {
    const res = await api({ action: "deleteUser", userId });
    if (res.success) { setDeleteConfirm(null); load(); }
  };

  const employees = users.filter(u => u.role === "employee");
  const managers  = users.filter(u => u.role === "manager");

  return (
    <div>
      <div className="page-title">User Management</div>
      <div className="page-sub">Add and manage employee and manager accounts</div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => { setShowAdd(true); setMsg(null); }}>+ Add User</button>
      </div>

      {/* ── Employees ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Employees ({employees.length})</div>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Loading…</div>
        ) : employees.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>No employees yet — add one above</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Visa Type</th>
                <th>Password</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{u.email}</td>
                  <td>
                    {u.visaType === "STEM_OPT" && <span className="chip chip-stem">STEM OPT</span>}
                    {u.visaType === "H1B" && <span className="chip chip-h1b">H-1B</span>}
                    {!u.visaType && <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{u.password}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(u)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Managers ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Managers ({managers.length})</div>
        </div>
        {managers.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>No managers yet</div>
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Password</th><th></th></tr></thead>
            <tbody>
              {managers.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{u.email}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{u.password}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(u)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add User Modal ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">Add New User</div>
            <div className="field"><label>Full Name *</label><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Priya Sharma" /></div>
            <div className="field"><label>Email *</label><input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="priya@company.com" /></div>
            <div className="field"><label>Password *</label><input value={form.password} onChange={e => set("password", e.target.value)} placeholder="Set a temporary password" /></div>
            <div className="grid-2">
              <div className="field">
                <label>Role</label>
                <select value={form.role} onChange={e => set("role", e.target.value)}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              {form.role === "employee" && (
                <div className="field">
                  <label>Visa Type</label>
                  <select value={form.visaType} onChange={e => set("visaType", e.target.value)}>
                    <option value="STEM_OPT">STEM OPT</option>
                    <option value="H1B">H-1B</option>
                    <option value="GC">Green Card</option>
                    <option value="USC">US Citizen</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}
            </div>
            <div className="alert alert-info" style={{ fontSize: 12 }}>
              Share the email and password with the user — they can log in immediately.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addUser} disabled={saving}>
                {saving ? <><span className="spinner" /> Adding…</> : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal">
            <div className="modal-title">Remove User</div>
            <p style={{ marginBottom: 20, color: "var(--muted)" }}>
              Are you sure you want to remove <strong style={{ color: "var(--text)" }}>{deleteConfirm.name}</strong>? This will delete their account but keep their evaluation history.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteUser(deleteConfirm.id)}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP SHELL ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("profile");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginMsg, setLoginMsg] = useState(null);
  const [logging, setLogging] = useState(false);

  const login = async () => {
    if (!loginForm.email || !loginForm.password) return setLoginMsg("Please enter email and password.");
    setLogging(true); setLoginMsg(null);
    const res = await api({ action: "login", data: loginForm });
    setLogging(false);
    if (res.success) {
      setUser(res.user);
      setPage(res.user.role === "manager" ? "team" : "profile");
    } else setLoginMsg(res.error || "Invalid credentials.");
  };

  if (!user) {
    return (
      <>
        <style>{CSS}</style>
        <div className="login-page">
          <div className="login-card">
            <div className="login-logo">TeamPulse</div>
            <div className="login-sub">Employee management portal</div>
            {loginMsg && <div className="alert alert-error">{loginMsg}</div>}
            <div className="field"><label>Email</label><input type="email" placeholder="you@company.com" value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))} onKeyDown={e => e.key === "Enter" && login()} /></div>
            <div className="field"><label>Password</label><input type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && login()} /></div>
            <button className="btn btn-primary btn-full" onClick={login} disabled={logging}>
              {logging ? <><span className="spinner" /> Signing in…</> : "Sign In"}
            </button>
            {DEMO_MODE && (
              <div className="demo-hint">
                <p><strong>Demo Accounts</strong></p>
                <p>STEM Employee: priya@company.com / pass123</p>
                <p>H-1B Employee: raj@company.com / pass123</p>
                <p>Manager: ankit@company.com / manager123</p>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  const visaType = user.visaType;
  const isManager = user.role === "manager";

  const navEmployee = [
    { id: "profile",  label: "My Profile",  icon: <Icon.Profile /> },
    ...(visaType === "STEM_OPT" ? [{ id: "eval", label: "Weekly Evaluation", icon: <Icon.Update /> }] : []),
    ...(visaType === "H1B" ? [{ id: "eval", label: "Monthly Evaluation", icon: <Icon.Update /> }] : []),
  ];
  const navManager = [
    { id: "team",    label: "Team Overview", icon: <Icon.Team /> },
    { id: "reviews", label: "Evaluations",   icon: <Icon.Reviews /> },
    { id: "users",   label: "Manage Users",  icon: <Icon.Users /> },
  ];
  const nav = isManager ? navManager : navEmployee;

  const badgeCls = isManager ? "badge-manager" : visaType === "STEM_OPT" ? "badge-stem" : visaType === "H1B" ? "badge-h1b" : "";
  const badgeLabel = isManager ? "Manager" : visaType === "STEM_OPT" ? "STEM OPT" : visaType === "H1B" ? "H-1B" : visaType || "";

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        <div className="sidebar">
          <div className="sidebar-logo">TeamPulse</div>
          <div className="sidebar-section">Navigation</div>
          {nav.map(n => (
            <div key={n.id} className={`nav-item${page === n.id ? " active" : ""}`} onClick={() => setPage(n.id)}>
              {n.icon}{n.label}
            </div>
          ))}
          <div className="sidebar-spacer" />
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-email">{user.email}</div>
            {badgeLabel && <div className={`sidebar-user-badge ${badgeCls}`}>{badgeLabel}</div>}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setUser(null)}>
                <Icon.Logout /> Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="main">
          {!isManager && page === "profile" && <EmployeeProfile user={user} />}
          {!isManager && page === "eval" && visaType === "STEM_OPT" && <StemEvaluation user={user} />}
          {!isManager && page === "eval" && visaType === "H1B" && <H1BEvaluation user={user} />}
          {isManager && page === "team" && <ManagerTeam user={user} />}
          {isManager && page === "reviews" && <ManagerReviews />}
          {isManager && page === "users" && <ManagerUsers />}
        </div>
      </div>
    </>
  );
}