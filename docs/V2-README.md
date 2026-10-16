# Rolodex front-end handoff package

This folder is a runnable front-end design workspace. It contains the application source, the local public image assets, database migrations, and a local PGlite data snapshot so layouts can be redesigned against real-sized content.

## Start here

1. Read [`DESIGN_HANDOFF.md`](DESIGN_HANDOFF.md).
2. In `app/`, install dependencies with `npm ci`.
3. Start the local app with `RX_NO_LOGIN=1 npm run dev`.
4. Open `http://localhost:4600`.

The application uses the included `app/.data/pglite` snapshot by default. Do not run `npm run reset-db`; it removes that local data.

## Included

- `app/src/` — all Next.js routes, components, and client/server code.
- `app/public/` — Rolodex branding, local contact photos, company avatars, and public work-status page.
- `app/.data/pglite/` — current local data snapshot for design testing.
- `app/package.json`, `package-lock.json`, TypeScript/Next configuration, and project instructions.
- `database/` — schema migrations.
- `DESIGN_HANDOFF.md` — product map, visual system, constraints, and validation checklist.

## Deliberately excluded

- `node_modules/` — install from `package-lock.json` with `npm ci`.
- `.next/` and TypeScript build artifacts — generated locally.

## Design guardrails

You may redesign layouts, CSS, and React components. Do not reset or alter the data snapshot, migrations, soft-delete/recovery logic, import/deduplication logic, or image-provenance rules unless that change is separately approved.
