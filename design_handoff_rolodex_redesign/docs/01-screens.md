# 01 · Screens

All measurements are CSS px. Colors use token names; hex values are in `tokens/tokens.css`.
"Today" in copy and logic means the user's local day in `America/Los_Angeles`.

---

## App shell (every authenticated page)

**Layout:** a full-viewport flex row on `--page`.

### Sidebar
- 240px wide, `padding: 16px 12px 12px`, no background (sits on `--page`).
- **Brand:** the Rolodex mark, 26×24 (top 80% of `rolodex-logo.png`), with "Rolodex" in 17/650 at −0.035em. `padding: 4px 8px 18px`.
- **Nav items:**
  - Each item is 34px tall, radius 8, `padding: 0 10px`, 11px gap, 16px icon, 14px label.
  - **Active:** white background, `--shadow-nav-active`, weight 600, accent-colored icon.
  - **Inactive:** text `--text3`, icon `--subtle`, weight 450. Hover background `#EAE8E2`.
- **Groups:**

  | Group | Items |
  |---|---|
  | Main | Today · Follow-ups · Contacts · Companies · To-dos |
  | **Sales** | Pipeline |
  | **Workspace** | Import · Settings · Recently deleted |

  Group labels are 11.5/600 in `--subtle`, `padding: 18px 10px 6px`.
- **Counts** (right-aligned, 12/600, tabular numbers):
  - Follow-ups shows a red pill (`--late-bg` / `--late-fg`), only when the count is above 0.
  - Contacts, Companies, To-dos and Pipeline show plain numbers in `--subtle`.
  - All counts are **live**.
- **Footer user button:** 32px photo, name 13/600, workspace 12px muted, and a `chevrons-up-down` icon. Clicking it opens **Settings › Profile**.

### Main sheet
- `padding: 8px 8px 8px 0`.
- The sheet is white, with a 1px `--line-sheet` border, radius 14 and `--shadow-sheet`. It scrolls vertically; horizontal overflow is hidden.

### Top bar
Sticky, 52px tall, `rgba(255,255,255,.9)` with a 12px backdrop blur and a 1px `--line-faint` bottom border. `padding: 0 16px 0 24px`. Left to right:

1. **Breadcrumb** (`flex: 1 1 220px`, minimum width 140).
   - The current page is 600 `--ink`; parent links are 450 `--muted`, separated by `chevron-right`.
   - Below 1080px viewport width, the parent crumb is hidden and only the record name shows.
2. **Search field** (`flex: 0 3 340px`, minimum width 150). See *Search dropdown* below.
3. **Bell:** a 34px icon button with a 7px red dot (`--danger-dot`, 2px white ring). It opens a 340px notifications menu.
4. **New contact:** a dark button (`--dark-button`), 32px tall, 13/550, white text, with a `plus` icon.

### Search dropdown (replaces the old full-screen ⌘K palette)
- **Field:** 34px tall, radius 9, 15px search icon, placeholder "Search or jump to…" and a `⌘K` key hint (hidden while open).
  - Idle: `#FBFAF8` background with a `--line` border.
  - Open: white background, `--accent` border and `--shadow-focus-ring`.
- **Opens on:** click or focus, ⌘K / Ctrl+K, or `/` from anywhere when you're not typing.
- **Panel:**
  - Right-aligned under the field, `top: 42px`. Width is `max(100%, 440px)`, capped at `100vw − 32px`.
  - Radius 14, menu shadow. The results list has a maximum height of `min(440px, 60vh)` and **no visible scrollbar**.
- **With nothing typed:** **Due today** (up to 4 people due) and **Actions**: Settings, Add to-do (Q), Add deal (D), New contact, and Go to each area.
- **While typing:** groups **People** (5), **Companies** (4), **Deals** (3) and **Actions** (4).
- **Result row:**
  - 42px tall, radius 9, a 26px avatar or icon tile, label 14/500, sub 13 `--subtle`, and a ↵ icon on the active row.
  - The active row has a `#F1F0EC` background.
- **Footer:** "↑ ↓ to move · ↵ to open · esc to close", 11.5px on `--surface-subtle`.
- **Empty result:** `Nothing matches “{query}”.`

---

## Today (dashboard)

Container max width 1180, `padding: 36px 44px 80px`.

1. **Header**
   - Date line: 13/500 muted, e.g. "Thursday, October 15".
   - Greeting: 30/650 at −0.03em, "Good afternoon, Brendan". It changes by hour: morning before 12, afternoon before 17, evening after.
   - Summary: 14.5 `--text4`, max width 620, `text-wrap: pretty`, e.g. "8 follow-ups need you today, 4 of them late. 3 to-dos are due."
2. **Stats strip**
   - Grid `repeat(auto-fit, minmax(160px, 1fr))` with 24px column gap.
   - 1px `--line-soft` borders on top and bottom. No card backgrounds.
   - Each stat: label 12.5 muted, value 24/650 tabular, sub 12.5 `--subtle`. The whole stat is a button that turns accent on hover.
   - Stats: Open pipeline · Won in October · Proposals out · Contacts.
3. **Two columns** (flex-wrap, gap 40×52)
   - **Left** (`flex: 1.6 1 480px`):
     - **Reach out today** with a red count pill. "All follow-ups →" link on the right. List of `FollowUpRow`, separated by a 1px `--line-faint` top border.
     - **Coming up this week**: up to 5 rows.
   - **Right** (`flex: 1 1 300px`):
     - **My to-dos** card: `--surface-subtle` background, 1px `#EFEDE8` border, radius 14, `padding: 18px 20px 14px`. Up to 5 `TodoItem`s, then "+ Add to-do", which opens the inline `TodoEditor` with the due date preset to today.
     - **Recent notes**: 4 items, each with a 28px kind tile, `about` in 13/600, when, and a 2-line clamped body. Clicking an item opens its record.
- **Empty state** for Reach out: "You’re all caught up." (16/600) and "Your next follow-ups will appear here."

---

## Follow-ups

Max width 920.

- **Header:** "Follow-ups" (26/650) and a summary line, "3 due today · 4 late · 2 later this week".
- **Segmented control** on the right: **All · People · Companies · Deals**, each with its count.
- **Groups**, each headed by an 8px dot, a 14/600 label and a count:

  | Group | Dot |
  |---|---|
  | Late | `#C0533F` |
  | Today | `#D38A17` |
  | This week | accent |
  | Later | `#B5B3AC` |

  **Later** shows 8 items, then "Show N more".
- **Empty state:** "Nothing to follow up on." and "Set a follow-up or a keep-in-touch rhythm and it shows up here when it’s time."

---

## Contacts directory

Max width 1400.

- **Title row:** "Contacts" with a muted count, "230 contacts" or "41 of 230 contacts".
- **Toolbar:**
  - Filter input (300px basis, 36px tall, radius 9, placeholder "Filter by name, company, email").
  - Sort segmented control on the right: Name · Last contact · Follow-up.
- **Kind chips** (30px tall, radius 8): All · Client · Prospect · Referral partner · Vendor · Friend · Connection · Former client, each with a count.
  - Selected chip: `--ink` background, white text.
- **Table** (CSS grid, no `<table>`):
  - **Wide (viewport ≥ 1180):** `minmax(0,2.2fr) minmax(0,1.6fr) 136px 100px 100px 64px` = Name · Company · Relationship · Last contact · Follow-up · actions.
  - **Narrow:** `minmax(0,2fr) minmax(0,1.4fr) 128px 92px`. Last contact and the call/email actions are dropped.
  - Header row: 36px, 12/550 `--subtle`.
  - Rows: minimum 56px, radius 8, hover `--hover-row`, 1px `--line-row` bottom border.
  - **Name cell:** 32px photo or initials, name 14/550, title 12.5 muted, ellipsis.
  - **Company:** a link-button that turns accent on hover.
  - **Relationship:** a kind pill.
  - **Follow-up:** colored by urgency (late `--late-fg`, today `--due-fg`), weight 600 when due.
- **Letter headers** when sorted by Name: sticky at `top: 52px`, 12/650 accent, translucent white with a blur.
- **Empty state:** "No contacts match." with a **Clear filters** button.

## Companies directory

Same structure as Contacts.

- **Kind chips:** All · Clients · Prospects · Referral partners · Vendors · Former clients · No relationship.
- **Filters:** an industry select (custom chevron) and a sort control: Name · Pipeline · Follow-up.
- **Columns:**
  - Wide: Company · Location · People · Open pipeline (right-aligned) · Follow-up · Relationship.
  - Narrow: Location and People are dropped.
- **Avatar:** a 32px rounded square (radius 9) showing the logo with `contain` on white, or initials.

---

## Contact record

Max width 1240.

### Header
- 64px photo.
- Name 26/650.
- "Title **at Company**". The company is a link.
- Kind pill and tag pills (12px, radius 6).
- **Actions** (36px, radius 9, `nowrap`): Call · Email · Text · **Add to pipeline** (dark) · ⋯

### Body
Flex-wrap, gap 32×40.

**Main column** (`flex: 1.7 1 520px`):
- **Composer card:** 1px `--line` border, radius 14.
  - Kind tabs: Note · Call · Email · Text · Meeting. 30px tall; the selected tab has a `--segment-track` background and its icon in the kind color.
  - Textarea: 3 rows, 14.5/1.55. Placeholder changes by kind, e.g. "What did you talk about?"
  - Pending attachments appear under the textarea.
  - Footer:
    - Left: **Attach** (paperclip) and the hint "Dated today · drop or paste files · ⌘↵ to save".
    - Right: "Log call" button, accent when the note has text or attachments and `#E7E5DF` otherwise.
- **Activity timeline:**
  - Vertical 1px line at x=15.
  - 31px kind circle with a 4px white ring.
  - Meta line: kind 600, then "by · date (· edited)", with **Edit** and **Delete** on the right (26px icon buttons in `--disabled`; hover turns Delete red).
  - Body 14.5/1.55 with `pre-wrap`.
  - Attachments: image thumbnails 132×96 (radius 10, click opens a lightbox) and file chips 40px tall with a download link and a trash button.

**Rail** (`flex: 1 1 300px`): cards with a 1px `--line` border, radius 14, white.
1. **Next follow-up**
   - Label, plus a reason pill when it's due or late.
   - Date 19/650, e.g. "Mon, Oct 12".
   - **Mark done**: full-width accent button.
   - After done, "How did you reach out?" with Call / Email / Text / Meeting / Skip.
   - Quick dates: Tomorrow · Next week · In 2 weeks · In a month · **Pick a date** (custom calendar) · Clear.
   - **Keep in touch** segmented control: Off · 30d · 60d · 90d · 6 mo, with a helper sentence.
2. **Details:** Phone (`tel:` link that opens the call/log toast) · Email (opens compose) · Location · Birthday · How you met · Introduced by · Last contact. Each has a 15px icon and a 12px label.
3. **Deals:** each row has a stage dot, name, "stage · close" and value. The header has "+ Add". Empty state: "Not in the pipeline yet."
4. **To-dos:** linked open to-dos, with "+ Add" (opens quick add linked to this contact). Empty state: "No open to-dos."
5. **Also at {Company}:** up to 5 coworkers.

## Company record

Same as the contact record, with these differences:
- **Avatar:** a 64px rounded square (radius 16) showing the logo.
- **Header line:** "Industry · City · website (link) · kind pill".
- **Actions:** Call · Email (to the main contact) · Website (opens a new tab) · **Add to pipeline** · ⋯
- **Stats strip** under the header: People · Open pipeline · Last activity.
- **Timeline** title: "Activity · company and its people". Notes on the company's contacts are included and labeled "with {name}".
- **Rail:** Next follow-up (no keep-in-touch control) · People · Deals · To-dos · About and Details (Phone, Website link, Location, Size, Industry).

---

## Pipeline

- **Header:**
  - Title "Pipeline" with a summary, e.g. "$394K open across 12 deals".
  - On the right:
    - Space-pan hint, "Hold Space and drag to pan". It turns into a dark pill reading "Drag to pan" while Space is held.
    - Board / List segmented control.
    - **Add deal** primary button with a `D` key hint.
- **Board:**
  - Horizontal flex, 12px gap, `padding: 0 40px 48px`, **no visible scrollbar**.
  - Six columns: Lead · Meeting · Proposal sent · Negotiating at 292px; Won · Lost at 256px.
  - Column: `#F6F5F1` background, radius 14, padding 10, minimum height 220.
  - Column header: stage dot, label 13.5/600, count, total value, and a **+** button on the four open stages.
  - **Card:**
    - White, 1px `--line-sheet` border, radius 11, `padding: 12px 12px 11px`.
    - Row 1: 18px company logo or initials (radius 5) and company name 12.5 muted.
    - Deal name 14/600.
    - Optional follow-up pill.
    - Bottom row: value 13.5/650, "Closes Nov 6" (amber when within 14 days), owner photo 22px.
    - Hover: border `#D3D0C7` and `--shadow-card-hover`.
    - A newly added card sorts to the top of its column and shows a 2.6s accent ring.
  - **Empty column:** a dashed button, "Drop a deal here or add one".
  - **Drop target:** column background `--accent-soft` with a 2px dashed outline in `--accent-drop`.
- **List view:**
  - Columns: Deal · Company · Stage (dot) · Value · Close · Owner.
  - Sorted by stage order, then by value.

## To-dos

Max width 860.

- **Header:**
  - Title, plus a sub line such as "6 to-dos · 1 overdue".
  - On the right: Mine / Everyone control and the **Add to-do** primary button with a `Q` key hint.
- **View tabs** (underline style, 42px tall, 2px `--ink` underline when active): Today · Upcoming · All · No date · Completed, with counts.
- **Today:**
  - **Overdue** group (red title) with a "Reschedule to today" link.
  - **Today** group with the date as its sub-label.
  - "+ Add to-do" at the end of each group.
- **Upcoming:**
  - A 14-day strip of 50px day tiles. Today's tile is dark; a dot means the day has to-dos.
  - Then 14 day sections. Each one accepts drops, and dropping a to-do changes its date.
- **All:** grouped by Date, Assignee, or Contact/company.
- **Completed:** grouped by the day each to-do was completed.
- **Empty states:**
  - Today: "All clear for today." and "Nothing due. Check Upcoming for what’s next."
  - Completed: "Completed to-dos show up here."

---

## Popups

All popups use the **optical-centering** rule: `left:50%; top:45%; transform:translate(-50%,-50%); max-height:calc(90vh − 48px)`. The scrim is `--scrim` with a 2px blur. Esc closes, clicking the scrim closes, and the body scrolls inside the popup.

| Popup | Width | Opened by |
|---|---|---|
| New contact | 540 | Top bar button, search action |
| Quick add to-do | 620 | Q, Add to-do buttons, record "+ Add", search |
| To-do detail | 640 | Clicking any to-do |
| Add to pipeline | 600 | D, Add deal, column +, record buttons, search |
| Email compose | 680 | Every Email button and email link |
| Settings | 900 × 640, left sidebar | Sidebar Settings, user button, search |
| Image lightbox | image size | Clicking an image attachment |

Details of each are in `02-interactions.md`.

### Settings
- **Sidebar:** 224px wide, `#F7F6F2` background with a right border.
  - **Account** group: Profile · Password · Notifications.
  - **Workspace** group: General · Team · Services · Email.
  - Active item: white background with `--shadow-nav-active` and an accent icon.
- **Content header:** title 18/650 plus a one-line description. Close button on the right.

| Section | Contents |
|---|---|
| **Profile** | 64px photo with **Upload photo** / Remove; Full name, Job title, Email, Phone (2-column grid, auto-saves) |
| **Password** | Current, New (3-bar strength meter: red, amber, green), Confirm; **Update password** with errors |
| **Notifications** | 5 rows, each with a 38×22 switch: Daily summary · Follow-up reminders · Assigned to me · Comments · Deal changes |
| **General** | Workspace name · Time zone (dropdown) · Week starts on (Sun/Mon, rotates every calendar) · Default keep-in-touch rhythm (applied to new contacts) |
| **Team** | Member rows with role dropdown (Owner/Salesperson) and Turn off / Turn on; "Add a person" card (name, email, role, **Send invite**) |
| **Services** | Ordered list with move-up and remove; "Add a service, press Enter". These feed the deal-name quick picks |
| **Email** | Google Workspace / Microsoft 365 connect cards · Signature textarea · "BCC me on every email" switch |
