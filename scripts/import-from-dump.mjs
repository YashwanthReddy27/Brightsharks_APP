// ============================================================
// Import the Apps Script dumpAll JSON into Vercel Postgres.
//
// Usage:
//   1. In Apps Script, run `dumpAll` (or POST {action:"dumpAll"} to the
//      web app) and save the response JSON to ./dump.json
//   2. Set DATABASE_URL in .env.local (Postgres connection string)
//   3. node scripts/import-from-dump.mjs ./dump.json
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const file = process.argv[2] || "./dump.json";
if (!fs.existsSync(file)) {
  console.error(`Dump file not found: ${path.resolve(file)}`);
  process.exit(1);
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  console.error("DATABASE_URL (or POSTGRES_URL) is not set.");
  process.exit(1);
}

const sql = neon(connectionString);

let rawText = fs.readFileSync(file, "utf8");
if (rawText.charCodeAt(0) === 0xfeff) rawText = rawText.slice(1); // strip UTF-8 BOM
const raw  = JSON.parse(rawText);
const dump = raw.data || raw; // tolerate either {success,data:{...}} or bare {...}

const safe = (v) => (v === undefined || v === "" ? null : v);
const parseMaybeJson = (s) => {
  if (s == null || s === "") return {};
  if (typeof s === "object") return s;
  try { return JSON.parse(s); } catch { return {}; }
};

async function importUsers() {
  const sheet = dump.Users;
  if (!sheet?.rows?.length) { console.log("Users: 0"); return; }
  for (const r of sheet.rows) {
    if (!r.id) continue;
    await sql`
      INSERT INTO users (id, email, password, name, role, visa_type)
      VALUES (${r.id}, ${r.email}, ${r.password}, ${r.name}, ${r.role}, ${safe(r.visaType)})
      ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            password = EXCLUDED.password,
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            visa_type = EXCLUDED.visa_type
    `;
  }
  console.log(`Users: ${sheet.rows.length}`);
}

async function importProfiles() {
  const sheet = dump.Profiles;
  if (!sheet?.rows?.length) { console.log("Profiles: 0"); return; }
  for (const r of sheet.rows) {
    if (!r.userId) continue;
    const data = parseMaybeJson(r.profileJson);
    await sql`
      INSERT INTO profiles (user_id, data, updated_at)
      VALUES (${r.userId}, ${JSON.stringify(data)}::jsonb,
              ${r.updatedAt ? new Date(r.updatedAt) : new Date()})
      ON CONFLICT (user_id) DO UPDATE
        SET data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
    `;
  }
  console.log(`Profiles: ${sheet.rows.length}`);
}

async function importSubmissions(sheetName, table, periodCol) {
  const sheet = dump[sheetName];
  if (!sheet?.rows?.length) { console.log(`${sheetName}: 0`); return; }
  let imported = 0;
  for (const r of sheet.rows) {
    if (!r.employeeId) continue;
    const data = parseMaybeJson(r.dataJson);
    const id = data.id || `${table[0]}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    if (!data.id) data.id = id;
    const reviewed = String(r.reviewed).toLowerCase() === "true";
    const submittedAt = r.submittedAt ? new Date(r.submittedAt) : new Date();
    // Sheets auto-coerces "2026-04" to a Date; prefer the canonical value from JSON.
    const period = data[periodCol] || (typeof r[periodCol] === "string" ? r[periodCol] : null);

    if (table === "weekly") {
      await sql`
        INSERT INTO weekly (id, employee_id, employee_name, week, data, submitted_at, reviewed)
        VALUES (${id}, ${r.employeeId}, ${safe(r.employeeName)}, ${period},
                ${JSON.stringify(data)}::jsonb, ${submittedAt}, ${reviewed})
        ON CONFLICT (id) DO UPDATE
          SET data = EXCLUDED.data,
              reviewed = EXCLUDED.reviewed,
              submitted_at = EXCLUDED.submitted_at
      `;
    } else {
      await sql`
        INSERT INTO monthly (id, employee_id, employee_name, month, data, submitted_at, reviewed)
        VALUES (${id}, ${r.employeeId}, ${safe(r.employeeName)}, ${period},
                ${JSON.stringify(data)}::jsonb, ${submittedAt}, ${reviewed})
        ON CONFLICT (id) DO UPDATE
          SET data = EXCLUDED.data,
              reviewed = EXCLUDED.reviewed,
              submitted_at = EXCLUDED.submitted_at
      `;
    }
    imported++;
  }
  console.log(`${sheetName}: ${imported}`);
}

console.log(`Importing from ${path.resolve(file)} ...`);
await importUsers();
await importProfiles();
await importSubmissions("Weekly",  "weekly",  "week");
await importSubmissions("Monthly", "monthly", "month");
console.log("Done.");
