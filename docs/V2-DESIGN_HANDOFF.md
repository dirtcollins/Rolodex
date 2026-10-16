# Rolodex front-end design handoff

## Product in one sentence

Rolodex is Collins Creative’s relationship workspace: a desktop-first contact and company directory with follow-ups, notes, to-dos, sales pipeline, outreach, and data-import tools.

The redesign should improve hierarchy, density, and navigation without changing the underlying records, workflows, or recovery safeguards.

## Run it locally

```bash
cd "/Users/brendan-macpro/Documents/Codex/Rolodex Software/Rolodex 2.0/app"
RX_NO_LOGIN=1 pnpm dev
```

Open `http://localhost:4600`. The app normally runs on port `4600`.

- `pnpm typecheck` validates the TypeScript app.
- `pnpm build` creates a production build.
- Local data lives under `app/.data/pglite`. Do **not** run `pnpm reset-db` on this workspace: it deletes the local database.

## Technology and boundaries

| Area | Choice |
| --- | --- |
| App | Next.js 16 App Router + React 19 + TypeScript |
| Styles | Plain CSS, no component-library dependency |
| Database | PGlite locally; Postgres/Supabase in a deployed environment |
| Icons | Local `Icon` component in `src/components/icons.tsx` |
| Images | Local WebP assets in `public/contact-avatars/`, `public/company-avatars/`, and `public/user-avatars/` |

The designer can safely redesign page markup, components, and styling. Keep data mutations, queries, migrations, and image provenance untouched unless the work specifically requires a product behavior change.

## App frame

The shared frame is [`src/components/shell.tsx`](app/src/components/shell.tsx).

Desktop has a fixed left navigation, search, notifications, and account control. Mobile replaces it with a compact top bar and bottom navigation. The shell appears on every authenticated page, so design it first.

Key shared UI pieces:

| Component | Purpose |
| --- | --- |
| `shell.tsx` | Sidebar, top bar, mobile frame, keyboard utilities |
| `nav.tsx` | Navigation groups and accurate live counts |
| `search.tsx` | Global search surface |
| `directory.tsx` | Shared contacts/companies table/list patterns |
| `contact-avatar.tsx` | Provenance-gated local contact photos with initials fallback |
| `company-avatar.tsx` | Logo/avatar with aspect-safe logo fitting and fallback initials |
| `user-avatar.tsx` | Brendan Collins’s locally stored avatar and generic fallback |
| `space-pan.tsx` | Spacebar hand-tool panning on horizontal surfaces |
| `ui.tsx` | Shared dialogs, controls, and notification primitives |

## Route map

| Route | Main job | Design considerations |
| --- | --- | --- |
| `/dashboard` | Follow-ups, to-dos, pipeline overview, activity | Make today’s work easy to scan. |
| `/contacts` and `/contacts/[id]` | Relationship directory and contact record | Directory needs fast filtering; records need a clear activity/details hierarchy. |
| `/companies` and `/companies/[id]` | Business directory and company record | Keep official logos compact and undistorted. |
| `/follow-ups` | Due/late relationship work | Prioritize urgency without making every item feel alarming. |
| `/todos` | Personal/team tasks | Support quick completion and clear context links. |
| `/pipeline` and `/pipeline/[id]` | Kanban/list sales pipeline | Preserve drag cards and desktop Spacebar panning. The native bottom scrollbar is intentionally hidden on desktop. |
| `/leads` | Lead qualification and sales work | Maintain list/table clarity at dense desktop widths. |
| `/network` | Relationship graph/list | Reuse contact cards and avatars. |
| `/outreach` and `/outreach/[id]` | Campaigns and outreach state | Keep send/review states unambiguous. |
| `/activities` | Timeline/history | Optimize for chronological scanning. |
| `/import` | Contact/company import | Keep mapping and review steps conservative. |
| `/deleted` | 30-day recovery area | Keep destructive controls unmistakable. It is currently empty. |
| `/settings`, `/account` | Preferences, account/team settings | Use simple form layouts. |

## Current visual system

Style files load in this order from `src/app/layout.tsx`:

1. `globals.css`
2. `design-system.css`
3. `dark-theme.css`
4. `focus.css`

`design-system.css` is the later layer and currently establishes the active desktop visual language. It supplies the muted neutral palette, 264px sidebar, compact controls, dialogs, rows, cards, responsive breakpoints, and dark-mode tokens.

Useful tokens include `--page`, `--surface`, `--soft`, `--ink`, `--muted`, `--line`, `--accent`, `--radius-control`, and `--radius-surface`. Reuse or deliberately consolidate them rather than scattering hard-coded colors.

The existing product uses:

- 264px desktop sidebar; mobile breakpoint at 820px.
- 64px top bar.
- 32px standard avatars, 52–56px record avatars.
- 8px control radius and 12px surface radius in the active design system.
- Light and dark themes through CSS variables and `data-theme`.

## Non-negotiable behavior to preserve

- **Sidebar counts:** Contacts and Companies show live active-record totals. Do not replace them with static values.
- **Avatars:** Contact photos and company logos are local assets, not remote hotlinks. Contact photos use `object-fit: cover`; company logos use `object-fit: contain` inside a circular avatar.
- **Image dimensions:** local variants are 64px, 104px, and 160px WebP. Existing components select the 64/104 variants for UI display and preserve fixed image dimensions to avoid layout shift.
- **Pipeline:** Spacebar switches to a hand cursor and click-drag pans horizontal content. It must not activate while typing, focus a card, select text, or interfere with card dragging.
- **Keyboard/focus:** Preserve visible keyboard focus for normal navigation. Spacebar panning intentionally clears non-text focus before the drag so it does not leave a focus ring.
- **Recovery:** Recently Deleted is the recovery surface; preserve its separate destructive actions and empty state.
- **Responsive behavior:** Rebuild intentionally for mobile rather than merely shrinking a desktop table.
- **Accessibility:** Keep semantic headings, form labels, `alt` text, button labels, contrast, and the existing skip-to-content link.

## Data and workflow safety

Avoid changing these as part of a visual redesign:

- `database/*.sql` migrations
- `src/lib/db.ts`, `src/lib/data.ts`, `src/lib/actions.ts`
- soft-delete and restore/purge flows
- import/deduplication logic
- local avatar provenance files and image storage rules

For any visual rework, test with real data volume: **230 active contacts**, **365 active companies**, dense company filters, multi-column pipeline stages, empty states, and long record names.

## Suggested design sequence

1. Document the proposed desktop navigation, top bar, page header, card, row, form, and dialog primitives.
2. Implement the app shell and tokens before page-by-page changes.
3. Redesign high-traffic views first: Dashboard, Contacts, Contact record, Companies, Company record, Follow-ups, and Pipeline.
4. Apply the shared primitives to lower-traffic pages.
5. Test desktop, tablet, and phone widths; dark mode; empty states; long names; keyboard navigation; and pipeline drag/pan.

## Validation checklist

```bash
pnpm typecheck
pnpm build
```

Then manually verify:

- Sidebar counts still match directory totals.
- Contact/company rows remain clickable and their nested controls still work.
- Contact photos and logos do not stretch, shift layout, or hotlink externally.
- Pipeline can still drag cards and pan with Spacebar without focus artifacts.
- Forms, dialogs, toasts, search, and mobile navigation remain usable.
- No data, migrations, imports, or Recently Deleted behavior changed unexpectedly.

## Current asset and enrichment state

- Contact photos: local, provenance-gated WebP assets; 64 confirmed entries are currently integrated, with additional verified Google batches staged separately for safe merge.
- Company avatars: every active company has 64/104/160 local WebP variants; official logos preserve original proportions.
- Brendan Collins uses supplied local 74px and 112px WebP avatar variants for the sidebar and account view.
- A live implementation tracker is available at `/work-status.html`.

