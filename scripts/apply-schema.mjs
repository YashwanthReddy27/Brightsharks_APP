// Apply db/schema.sql to the database in DATABASE_URL.
// Usage: node scripts/apply-schema.mjs

import fs from "node:fs";
import { Pool } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  console.error("DATABASE_URL (or POSTGRES_URL) is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const ddl  = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// Strip line-comments first so they don't masquerade as statement bodies,
// then split on ; that ends a line.
const stripped = ddl
  .split("\n")
  .filter(line => !line.trim().startsWith("--"))
  .join("\n");

const statements = stripped
  .split(/;\s*(?:\r?\n|$)/)
  .map(s => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  console.log(stmt.split("\n")[0].slice(0, 80) + " ...");
  await pool.query(stmt);
}
await pool.end();
console.log(`Applied ${statements.length} statements.`);
