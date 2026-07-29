# BrightSharks

React + Vite frontend. Data lives in **Vercel Postgres (Neon)**, served
by a single serverless function at `/api`. Google Apps Script is kept
around only as an **email service** (transactional + scheduled
reminders) — it no longer owns any data.

```
┌────────────┐   POST /api    ┌──────────────┐   server-side    ┌─────────────────┐
│  Browser   │ ─────────────► │ Vercel API   │ ───────────────► │ Apps Script     │
│ (React SPA)│                │ (api/index)  │   (emails only)  │ (MailApp)       │
└────────────┘                └──────┬───────┘                  └─────────────────┘
                                     │
                                     ▼
                            ┌────────────────┐
                            │ Vercel Postgres│
                            │   (Neon)       │
                            └────────────────┘
```

## One-time migration

### 1. Provision Vercel Postgres
- In the Vercel dashboard: project → **Storage** → **Create Database** → Postgres (Neon).
- Vercel adds `DATABASE_URL`, `POSTGRES_URL`, etc. to the project env.
- Pull them locally:
  ```powershell
  npx vercel env pull .env.local
  ```

### 2. Apply the schema
```powershell
npm install
npm run db:schema
```

### 3. Dump the spreadsheet
Re-deploy `apps-script-backend.js`, then in PowerShell:
```powershell
$body = '{"action":"dumpAll"}'
Invoke-RestMethod -Uri "<your-apps-script-url>" -Method POST -Body $body `
  -ContentType "text/plain;charset=utf-8" | ConvertTo-Json -Depth 100 > dump.json
```

### 4. Import into Postgres
```powershell
npm run db:import -- ./dump.json
```

### 5. Wire Apps Script as email-only
- In `apps-script-backend.js`, set `VERCEL_API_URL` to your Vercel deploy URL + `/api`.
- Re-deploy the Apps Script Web App.
- In Vercel project settings, set env var `APPS_SCRIPT_URL` to the Apps Script web app URL (so the API can trigger emails).
  `api/index.js` falls back to the last known web app URL if this is unset, but set it — a re-deploy of the
  Apps Script mints a new `/exec` URL and the fallback goes stale.
- The Web App must be deployed as **Execute as: Me** / **Who has access: Anyone**, otherwise `MailApp` has no
  permission to send and every email fails.

### 6. Deploy frontend
```powershell
git push   # Vercel auto-deploys
```
The frontend now calls `/api` (Vercel Postgres) for all data and never hits Apps Script directly.

## Local development
```powershell
npm install
npm run dev               # frontend only (uses /api on the deployed origin via dev proxy or vercel dev)
# OR for full local stack including /api function:
npx vercel dev
```

## Project layout
```
api/
  index.js                # /api endpoint (action router → Postgres)
  _db.js                  # neon() client + id helpers
db/
  schema.sql              # table definitions
scripts/
  apply-schema.mjs        # npm run db:schema
  import-from-dump.mjs    # npm run db:import dump.json
src/
  App.jsx                 # React SPA — calls /api
apps-script-backend.js    # email service only
vercel.json               # SPA rewrite (excludes /api/*)
```
