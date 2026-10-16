# Rolodex redesign: design handoff

Prepared for Collins Creative's developers and designers.
Prototype date: Oct 15, 2026. The "today" the prototype uses is fixed to **Thursday, Oct 15, 2026** (America/Los_Angeles).

---

## 1. What this is

A complete, high-fidelity redesign of **Rolodex**, Collins Creative's relationship workspace: contacts, companies, follow-ups, to-dos, pipeline and email. It changes hierarchy, navigation, density and interaction. **Records, workflows and recovery safeguards stay the same.**

The `prototype/` folder holds a working, clickable prototype. Every screen, popup and flow described here can be tried in it.

### About the files: read this first

The prototype files are **design references built in HTML**. They are not production code to copy into the app. They show the exact look, copy and behavior.

The job is to **recreate these designs in the existing Rolodex codebase**:
- Next.js 16 App Router, React 19 and TypeScript.
- Plain CSS through `design-system.css`.
- The local `Icon` component.
- The existing data layer, `lib/data.ts` and `lib/actions.ts`.

Use the codebase's own patterns. The prototype keeps its data in memory, so nothing persists and nothing reaches the database.

### Fidelity

**High-fidelity.** Colors, type, spacing, radii, shadows, copy and interactions are final. Recreate them pixel-for-pixel using the tokens in `tokens/`.

---

## 2. Package contents

```
design_handoff_rolodex_redesign/
├── README.md                    ← you are here (overview, how to run, priorities)
├── docs/
│   ├── 01-screens.md            ← every screen: layout, components, copy
│   ├── 02-interactions.md       ← flows, states, keyboard, validation, undo
│   ├── 03-components.md         ← shared primitives (rows, menus, popups, pickers)
│   ├── 04-data-and-state.md     ← data model additions + state per feature
│   ├── 05-implementation-map.md ← which existing app files each change touches
│   └── 06-open-items.md         ← decisions still needed, known gaps, QA checklist
├── tokens/
│   ├── tokens.css               ← CSS custom properties (drop-in for design-system.css)
│   └── tokens.json              ← same values as JSON (for Figma / Style Dictionary)
└── prototype/                   ← runnable HTML prototype (design reference)
    ├── Rolodex.dc.html          ← the whole app (open this)
    ├── FollowUpRow.dc.html      ← follow-up row component
    ├── TodoItem.dc.html         ← to-do row component
    ├── TodoEditor.dc.html       ← quick-add editor
    ├── PickMenu.dc.html         ← dropdown menu (+ calendar slot)
    ├── DatePicker.dc.html       ← custom calendar
    ├── support.js               ← prototype runtime (not for production)
    └── assets/                  ← logo, photos, company logos used by the prototype
```

## 3. Running the prototype

The prototype loads sibling files, so serve it from a local web server. Opening it straight from Finder (`file://`) won't work.

```bash
cd design_handoff_rolodex_redesign/prototype
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080/Rolodex.dc.html
```

Try these:
- **⌘K or /**: search (dropdown in the top bar).
- **Q**: quick-add a to-do.
- **D**: add a deal.
- **Today**: click **Done** on a follow-up, then pick how you reached out.
- **Pipeline**: drag cards. Hold **Space** and drag to pan.
- **Any Email button**: opens the compose popup.
- **Sidebar → Settings**: opens Settings.

The prototype uses sample data at real volume: 230 contacts, 365 companies and 15 deals. Fourteen hand-written contacts drive the dashboard.

---

## 4. Design principles

1. **Today first.** The dashboard answers "who do I reach out to, and what's due" before anything else.
2. **One action, one click.** Done, Later, Email, Add to pipeline and Add to-do are always one click from where the record appears.
3. **Everything is undoable.** Every change shows a toast with **Undo**: completing, moving, deleting, sending, editing.
4. **Popups are optically centered.** All dialogs sit at 50% horizontally and 45% vertically, measured from the dialog's center, with at least 24px of clearance at the top.
5. **No layout shift.** Placeholders match the final layout exactly. There are no gray boxes, borders or shimmer.
6. **Quiet chrome, strong content.** Warm neutral surfaces. Blue (`#2F5BEA`) is used only for primary actions, focus and selection.

---

## 5. Build priority (suggested order)

| # | Area | Why first |
|---|------|-----------|
| 1 | Tokens + app shell (sidebar, top bar with search dropdown) | Every screen depends on it |
| 2 | Popup system (optical centering, Esc, outside click, focus) | Used by 7 features |
| 3 | Today (dashboard) + follow-up row | Highest-traffic screen |
| 4 | Contacts / Companies directories | Second-highest traffic |
| 5 | Contact & company records (composer, timeline, rail) | Where work gets logged |
| 6 | To-dos (views, quick add, detail popup) | Feature is now Todoist-grade |
| 7 | Pipeline (board, list, add-deal dialog) | Drag + Space-pan already exists |
| 8 | Email compose popup | Main new capability |
| 9 | Attachments, edit/delete for notes & comments | Applies to the composer + to-dos |
| 10 | Settings popup | Low traffic, simple forms |
| 11 | Phone layout | **Not designed yet**; see `docs/06-open-items.md` |

---

## 6. Non-negotiables carried over from the original handoff

- **Sidebar counts are live.** They show Contacts and Companies totals, open to-dos, open deals and due follow-ups.
- **Contact photos and company logos are local WebP files.** Photos use `object-fit: cover` in a circle. Logos use `object-fit: contain` on white inside a **9px rounded square**. The redesign uses a rounded square so companies can be told apart from people at a glance.
- **Pipeline:** Space switches to a hand cursor and click-drag pans. It must not trigger while typing or during a card drag. The bottom scrollbar is hidden.
- **Recently Deleted** remains the recovery surface. Deleting a to-do moves it there.
- Visible keyboard focus, semantic headings, labels, `alt` text and the skip link all stay.
- **Do not change** the migrations, `db.ts`, the import/dedupe logic, the soft-delete flows or photo provenance.

## 7. Assets

| Asset | Source | Notes |
|---|---|---|
| `assets/rolodex-logo.png` | `app/public/rolodex-logo.png` | Sidebar shows the mark only: top 80%, 26px wide |
| `assets/brendan-collins-112.webp` | `app/public/user-avatars/` | Current user |
| `assets/people/*.webp` | `app/public/contact-avatars/*-104.webp` | **Matched to placeholder names for the demo only.** In production, use each contact's own provenance-gated photo |
| `assets/logos/*.webp` | `app/public/company-avatars/*-104.webp` | 36 logos matched to real company names from `app/tools/*.mjs`. Production already has all 365 |
| Icons | Lucide (static font 0.460) in the prototype | Map each name to the app's `Icon` component. The full list is in `docs/03-components.md` |
| Font | **Onest** (Google Fonts), weights 400/500/600/700 | Replaces the current system stack |

---

## 8. Before shipping

Run `pnpm typecheck && pnpm build`, then go through the QA checklist in `docs/06-open-items.md`.
