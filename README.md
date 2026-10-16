# Rolodex

Collins Creative's relationship workspace: contacts, companies, follow-ups, to-dos, pipeline and email.

## What's in this repo

| Path | What it is |
|---|---|
| `index.html`, `*.dc.html`, `support.js`, `assets/` | **Rolodex V3**, the approved redesign. A single-page app that runs in the browser. |
| `app/` | The Next.js app (V2): pages, API routes, sign-in, data layer, email, import, photo and logo assets. This is the engine V3 will save through. |
| `database/` | Postgres schema migrations (`001`–`009`). The app runs them once each, in order. |
| `design_handoff_rolodex_redesign/` | Design handoff for V3: screens, interactions, design tokens and the original prototype. |
| `docs/` | The 2.0 audit and plan, the features list, and the V2 handoff and README. |
| `tools/export-v2-data.mjs` | Exports records from the app's database into `data/rolodex-data.js` for V3. |
| `FINISH-PLAN.md` | What's left to finish V3. |

## Run V3 (the redesign)

V3 loads its component files from the same folder, so serve the folder rather than opening `index.html` directly:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080/. With no `data/` folder it shows sample data. To load real records, export them from the app's database:

```bash
node tools/export-v2-data.mjs <copy of app/.data/pglite> app/public .
```

Export from a **copy** of the database folder, with the app stopped. Changes made in V3 aren't saved yet; wiring V3 to the app's API is the next step in `FINISH-PLAN.md`.

## Run the app (V2)

Tech stack: Next.js 16 (App Router), React 19, TypeScript, PGlite locally, Postgres/Supabase when deployed, Resend for email. It needs Node 20.9 or newer.

```bash
cd app
npm ci
cp .env.example .env.local   # then fill in what you need
RX_NO_LOGIN=1 npm run dev
```

Then open http://localhost:4600. Other scripts: `npm run typecheck`, `npm run build`, `npm start`. **Don't run `npm run reset-db`**: it deletes the local database.

## Data and backups

GitHub stores the code only. Customer records live in the database (`app/.data/` on this Mac, or Postgres when deployed), and that folder is deliberately left out of git. Back up the database separately.
