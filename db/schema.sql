-- BrightSharks v2 — Vercel Postgres (Neon) schema
-- Run once after provisioning the database.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT        PRIMARY KEY,
  email       TEXT        NOT NULL,
  password    TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  visa_type   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uniq ON users (LOWER(email));
CREATE INDEX        IF NOT EXISTS users_role_idx         ON users (role);

CREATE TABLE IF NOT EXISTS profiles (
  user_id     TEXT        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weekly (
  id            TEXT        PRIMARY KEY,
  employee_id   TEXT        NOT NULL,
  employee_name TEXT,
  week          TEXT        NOT NULL,
  data          JSONB       NOT NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed      BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS weekly_employee_idx      ON weekly (employee_id);
CREATE INDEX IF NOT EXISTS weekly_employee_week_idx ON weekly (employee_id, week);

CREATE TABLE IF NOT EXISTS monthly (
  id            TEXT        PRIMARY KEY,
  employee_id   TEXT        NOT NULL,
  employee_name TEXT,
  month         TEXT        NOT NULL,
  data          JSONB       NOT NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed      BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS monthly_employee_idx       ON monthly (employee_id);
CREATE INDEX IF NOT EXISTS monthly_employee_month_idx ON monthly (employee_id, month);
