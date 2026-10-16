# Finishing Rolodex V3

October 16, 2026

## Where things stand

**V2** (`Rolodex Software V2/app` and `V2/database`) is the working software. It's a Next.js 16 app with:
- sign-in and team roles
- a real database: PGlite on this Mac in `app/.data` (57 MB, the live records) and Postgres/Supabase when deployed
- email sending through Resend
- CSV import, duplicate checks and merge
- soft delete with Recently Deleted
- leads, network, activities and outreach campaigns (built, but hidden from the sidebar)

It isn't hosted anywhere yet.

**V3** (this folder) is the redesign. It's a clickable HTML prototype that runs on made-up sample data shaped like V2's data (230 contacts, 365 companies). Nothing saves, there's no sign-in, and email isn't really sent. The handoff README says it's a design reference: the job is to rebuild V2's screens to look and behave like V3, keeping V2's database and actions.

So finishing V3 means putting V3's design onto V2's working engine. V3's HTML isn't the product itself.

The older top-level `Rolodex Software/app` is out of date (no migrations 008–009, no avatars, no paged lists) and can be retired.

## 1. Decisions needed first

1. **Approach.** Rebuild V2's screens to match V3, as the handoff intends (recommended). The alternative is turning the V3 HTML into the product, which would mean writing a new backend and throwing V2's away.
2. **V2 features that V3 doesn't design.** For each one, decide whether to keep it in the old style for now, design it, or drop it:
   - **Must keep:** sign-in page, My account, Import (V3 shows a "not part of this prototype" message), Recently Deleted (the handoff says it must stay as the recovery screen), editing contact and company details, delete, merge.
   - **Missing from V3:** a deal record page (V3 sends deal clicks to Pipeline or the company), and the ··· menu on records, which does nothing in V3.
   - **Already hidden in V2:** Leads, Network, Activities, Outreach campaigns.
   - **Bell notifications:** V2 works them out live; V3 has three fixed sample items.
3. **Phone layout.** The handoff calls it "not designed yet". V2 already has a phone layout.
4. **Email accounts.** V3's Settings has "Connect Google Workspace / Microsoft 365". V2 sends through Resend only. Decide which one ships.
5. **Hosting.** Pick a host and a production Postgres (the code is set up for Supabase), and plan how to move the live records out of the PGlite folder on this Mac.

## 2. Database and backend additions V3 needs

These are features in V3 that V2's database can't store yet. Each one needs a new migration (010 and up); existing migrations stay as they are.

| V3 feature | What V2 has | Work |
|---|---|---|
| Files and photos on notes (thumbnails, lightbox) | Nothing | File storage (for example Supabase Storage), an attachments table, upload and delete actions |
| To-do subtasks ("1/3") | Nothing | Subtasks table and actions |
| To-do comments, with attachments | Nothing | Comments table and actions |
| Deal owner (avatar on each card) | `opportunities` has no owner | Add `owner_id` to opportunities |
| One relationship type per company (Client, Prospect…) | Companies only have `tags[]` | Add a field, or derive it from tags |
| Contact relationship type | `kinds[]` list (V3 shows one) | Decide which one to show when there are several |
| Settings: time zone, week start, default keep-in-touch, notification switches, BCC, signature | Signature and services only | Store in `settings` / `users` |
| Email templates in compose | `email_templates` table exists | Wire up only |
| Edit note, with an "edited" label | `note.save` exists | Add an edited-at timestamp |

## 3. Screens to build in V2 (handoff order)

1. Design tokens (`design_handoff_rolodex_redesign/tokens/`) and the app shell: sidebar, top bar, search dropdown, ⌘K / Q / D shortcuts
2. Popup system: optically centered, Esc order, click outside saves
3. Today page and the follow-up row: Done → "How did you reach out?", Later menu
4. Contacts and Companies directories
5. Contact and company records: composer, timeline, rail
6. To-dos: tabs, typed dates like "tmrw" or "oct 20", calendar, detail popup with subtasks and comments
7. Pipeline: board and list, drag, Space-to-pan, the 5-step Add deal dialog
8. Email compose: templates, real attachments, Undo send
9. Attachments, plus note and comment editing
10. Settings: Profile, Password, Notifications, General, Team, Services, Email
11. Phone layout, once it's designed

Do the screens one at a time, and test each against the real database before moving on.

## 4. Gaps in the handoff package

- **Four of the six handoff docs are missing:** `03-components.md` (shared pieces and the icon list), `04-data-and-state.md` (how V3 data maps to the database), `05-implementation-map.md` (which V2 files each change touches) and `06-open-items.md` (open decisions and the QA checklist). Get them from whoever made the handoff, or write them; sections 1–2 above cover most of 04 and 06.
- **Prototype bugs to avoid copying:**
  - A contact's last name gets overwritten by the last-contact date (`index.html` around lines 1308 and 1877).
  - The greeting uses the real clock while the rest of the page uses a fixed date.
  - The bell items are hard-coded.
- **Old instructions.** V2's `DESIGN_HANDOFF.md` uses `pnpm` and an old folder path. The project uses `npm`.

## 5. Shipping checklist

- `npm run typecheck` and `npm run build` pass
- A QA pass on every screen, with light and dark themes and keyboard use
- Recovery still works: Undo, Recently Deleted and restore
- GitHub repo set up (private), with no `.env` files or local database committed
- Production database created, migrations run, live records copied over, and a backup plan in place (GitHub stores code, not customer records)
- Host set up with its environment variables (`DATABASE_URL`, `RX_AUTH_SECRET`, `RX_OWNER_*`, `RESEND_API_KEY`)
