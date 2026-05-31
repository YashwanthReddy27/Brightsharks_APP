// Quick sanity check after import.
// Usage: node scripts/verify-import.mjs

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const sql = neon(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING
);

const [u, p, w, m] = await Promise.all([
  sql`SELECT COUNT(*)::int AS c FROM users`,
  sql`SELECT COUNT(*)::int AS c FROM profiles`,
  sql`SELECT COUNT(*)::int AS c FROM weekly`,
  sql`SELECT COUNT(*)::int AS c FROM monthly`,
]);

console.log(`users:    ${u[0].c}`);
console.log(`profiles: ${p[0].c}`);
console.log(`weekly:   ${w[0].c}`);
console.log(`monthly:  ${m[0].c}`);

const sampleMonth = await sql`SELECT employee_name, month FROM monthly LIMIT 2`;
console.log("\nSample monthly rows (verify month is '2026-04' not a date):");
sampleMonth.forEach(r => console.log(`  ${r.employee_name}: ${r.month}`));
