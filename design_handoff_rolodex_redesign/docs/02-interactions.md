# 02 · Interactions & behavior

## Global

| Input | Behavior |
|---|---|
| ⌘K / Ctrl+K, or `/` | Opens the search dropdown. ⌘K toggles it. `/` only works when you're not typing |
| `Q` | Opens Quick add to-do |
| `D` | Opens Add to pipeline |
| `Esc` | Closes the top-most layer, in this order: menus → note/comment edit → settings → lightbox → deal → email → search → new contact → quick add → to-do detail → popovers |
| Click outside | Closes menus and popovers, and auto-saves an open note or comment edit (see below) |
| Space (Pipeline board only) | Hand-tool panning. Clears focus first. Ignored while typing, while a popup is open, or during a card drag |

Single-key shortcuts (`Q`, `D`, `/`, Space) are ignored while typing in an input, textarea or select, and while any popup is open.

### Toasts
- **Position and style:** bottom-center, 24px from the bottom. Dark (`--toast`), radius 12. They slide up 16px and fade in over .28s with `cubic-bezier(.2,.8,.2,1)`.
- **Content:**
  - A green check icon and a 13.5/550 message.
  - An optional 12.5 sub-line in `--toast-sub`.
  - An optional action button (Undo, Open, View pipeline, Log call…) and a close ×.
- **Timing:** auto-hide after 5s. Only one toast shows at a time; a new one replaces it.
- **Undo** restores the snapshot taken right before the change. Data updates are immutable, so the snapshot is simply the previous state reference.

---

## Follow-ups

**Row** (`FollowUpRow`): clicking anywhere opens the record. A **deal** follow-up opens the deal's company.

**Done:**
1. The reason pill turns green and reads "Done".
2. A second line appears: **How did you reach out?** with Call · Email · Text · Meeting · Skip.
3. A toast shows "Done · {name}" with Undo. For keep-in-touch contacts it adds "Back on your list {date}".

Picking a method:
- Logs a timeline entry "Followed up" with that kind, dated today.
- Sets last contact to today.
- Sets the next follow-up to today + the rhythm if the contact has one, and clears it otherwise.
- Collapses the row: `opacity .22s`, `max-height .3s`, removed after 300ms.

**Skip** does the same but logs nothing. The prototype setting `askHow = false` skips step 2 entirely.

**Later:** a menu right-aligned under the button with Tomorrow · Next week · In 2 weeks · In a month, each showing its date. Picking one moves the follow-up; the toast shows "Moved to {day}" with Undo.

**Call / Email icons:**
- **Call** shows a toast "Calling {name} · {phone}" with a **Log call** action, which adds a timeline note.
- **Email** opens the compose popup.

## Record composer and timeline
- **Kind tabs:** Note · Call · Email · Text · Meeting.
- **Save:** ⌘↵ or the Log button. A note can be saved with **text, attachments, or both**.
  - Any kind other than Note sets the contact's last contact to today.
  - The toast reads "Call logged · 2 attachments · Last contact updated to today".

### Attachments (anywhere you write a note or comment)
- **Ways to add:** the paperclip opens the file picker (multiple files), dragging files onto the box shows a "Drop to attach" overlay, or pasting images from the clipboard.
- **While writing:** images show as 64×64 thumbnails and files as chips with name and size. Each has an × to remove it.
- **After saving:** images show as 132×96 thumbnails; clicking one opens the lightbox (Esc or click closes it). Files show as chips with a download link and a trash button.
- **Deleting a single attachment:** a trash button on each image (top-right) and each file chip. Toast "Removed {file}" with Undo.

### Edit and delete a note or comment
- **Pencil:** switches that note into edit mode with a textarea, the current attachments (removable), Attach, Cancel and Save.
- **Ending an edit:**

  | Action | Result |
  |---|---|
  | Click outside | Leaves edit mode. **Changed:** auto-saves, toast "Note saved" with Undo. **Unchanged:** closes silently. **Emptied:** discards the edit (use Delete to remove the note) |
  | Esc / Cancel | Restores the original text and attachments |
  | Save, or ⌘↵ (notes) / ↵ (comments) | Saves; the note gets a "· edited" label |
  | Pencil on another note | Auto-saves the current one first |
  | Trash | Deletes the note, toast with Undo |

## To-dos

### Quick add (`TodoEditor`)
Fields: **task name**, **Date** and **Assignee**.
- **Dates typed into the name are recognized and highlighted** with a green underlay:

  | Type | Examples |
  |---|---|
  | Relative days | `today`, `tod`, `tomorrow`, `tmrw` |
  | Weeks | `next week` (next Monday), `weekend` (next Saturday) |
  | Offsets | `in 3 days`, `in 2 weeks` |
  | Weekdays | `fri`, `friday`, `next tue` |
  | Dates | `oct 20`, `October 20th`, `10/20` (past dates roll to next year) |

  The recognized text is removed from the saved title. The last date wins.
- **Date chip:** a menu with Today · Tomorrow · This weekend · Next week · No date, and the **custom calendar** beside it (two-column menu, 560px wide). Choosing from the chip removes any typed date.
- **Assignee chip:** a menu with each active teammate's **photo**; the current one has a check. The default is the current user.
- **Context presets:** each section's "+ Add" presets its date (or assignee, when grouped by assignee). Adding from a record links the to-do to that record.
- **Submit:** Enter or **Add to-do**. Esc closes the menu, then the editor. Toast "To-do added · Fri, Oct 17 · Assigned to Riley" with an **Open** action.

### List row (`TodoItem`)
- **Circle checkbox:** 20px, 1.75px ring. Hovering it fills it in `--accent-soft` with an accent check.
- **Completing:** the row fades to 50% for 450ms, then moves to Completed. Toast with Undo.
- **Meta line** (only items that have data): date with urgency color (overdue = red + " · overdue"), subtasks `n/m`, comment count, and linked record (clicking it opens the record).
- **Assignee photo** shows on the right when the to-do isn't yours, or in the Everyone view.
- **Drag and drop:** a 2px accent line shows where it will drop. Dropping into another section applies that section's date or assignee.

### Detail popup (click a to-do)
- **Header:** the linked-record chip (opens the record), Delete (moves it to Recently deleted, with Undo) and Close.
- **Title:** large checkbox, plus the title as an inline input 20/650. It saves as you type.
- **Field buttons:** Date and Assignee, each opening the same menus as quick add.
- **Subtasks:**
  - A progress bar and "n of m".
  - Each subtask has a check and an × to delete it.
  - "Add a subtask" input; Enter adds.
- **Comments:**
  - Each comment shows photo, name and date (· edited), with edit/delete actions, text and attachments.
  - The new-comment box supports attachments by picker, drop or paste. Enter sends and Shift+Enter adds a new line.
- **Footer:** "Added Oct 8 by Brendan" and "Esc to close".

## Pipeline
- **Drag a card** to another column to change its stage. Dropping on Won or Lost sets the close date to today. The toast reads "Moved to Proposal sent" (or "Won · $85,000 with Kern Valley Health") with Undo.
- **Click a card** to open the company (ignored while panning).
- **Add to pipeline dialog:**
  1. **Who is it with?** A combined search of people and companies, with a tag on each result.
     - Picking a **person** fills in their company.
     - Picking a **company** preselects its first contact. A **Main contact** chip row lets you change it.
     - **Create company “X”** adds a new prospect company.
     - The **Change** button resets the choice.
     - An amber note appears when the company already has open deals, e.g. "Kern Valley Health already has an open deal: 2027 brand refresh ($85K, Proposal sent). This will be a separate deal."
  2. **What is it?** Service chips (from Settings › Services) fill in the name, which you can still edit.
  3. **Value** (optional, digits only) and **Expected close** (30, 60 or 90 days, or a calendar that opens upward).
  4. **Stage** segmented control, preset from the column + button. **Owner** chips show active teammates with photos.
  5. **"Remind me to follow up {weekday}"** (on by default) sets the next follow-up to today + 3.
- **Validation:**
  - No one picked: "Pick who this deal is with."
  - No name: "Give the deal a name, or pick a service above."
- **Save** (⌘↵ or "Add to {stage}"): the card is added, sorted to the top of its column and highlighted for 2.6s. The toast's **View pipeline** action appears when you add from outside the Pipeline.

## Email compose
- **Opened by** every Email button: follow-up rows, directory rows, contact and company records, and email links in Details.
- **Fields:**
  - **To:** a chip with the contact's photo and name, plus an editable address.
  - **Cc / Bcc:** shown on demand. Bcc is pre-filled with your address when "BCC me" is on in Settings.
  - **Subject**, then the message, pre-filled with the **signature** from Settings.
- **Templates menu:** Check-in · Proposal follow-up · Thanks for meeting · Ask for an intro. `{first}` is replaced with the contact's first name, or "there" if unknown.
- **Attachments:** the paperclip. The prototype uses sample PDFs; production needs real file upload.
- **"Mark follow-up done"** checkbox: shown, and checked by default, when the person's follow-up is due.
- **Send** (⌘↵):
  - Validates that To is a valid address and that there's a subject or a message.
  - Logs an email note on the timeline, e.g. "Sent “Subject”. First line… (2 attachments)".
  - Updates last contact, and completes the follow-up if that box is checked.
  - Toast "Email sent to {name}" with **Undo send**, which restores the data and reopens the draft.
- **Close or Esc** with content shows "Draft discarded" with Undo.

## Settings
- **Profile:** edits save as you type and update the sidebar footer. A photo upload replaces your avatar everywhere.
- **Password validation, in order:**
  1. Current password is required.
  2. New password must be at least 8 characters.
  3. The confirmation must match.

  On success: "Password updated · Other devices will need to sign in again".
- **Team:**
  - A turned-off person's row is dimmed and marked "Off". They're removed from the Assignee and Owner pickers but stay on existing records.
  - Invites check the name and email, then add the person to the pickers right away.
- **Services:** the order you set here is the order of the deal-name chips.

## Loading
- **Cause of the gray placeholder boxes:** they appeared only on the **first page load**, while the separate component files downloaded. **Navigating within the app never re-fetches.**
- **Fix:**
  - Every component starts downloading at startup.
  - Until it's ready, each row shows a **layout-matched placeholder**: avatar circle, two text bars of stable width, button space, at the exact final height. No borders, no shimmer.
- **For production:** use **stale-while-revalidate**.
  - Keep the last dashboard payload, for example in a client cache or the router cache, and render it instantly when you come back to it.
  - Refresh quietly in the background.
  - Only the very first visit should show placeholders, and they must match the final layout so nothing shifts.

## Validation copy (exact)

| Form | Message |
|---|---|
| New contact | "Add a first name to save this contact." / "That email address doesn’t look complete." |
| Deal | "Pick who this deal is with." / "Give the deal a name, or pick a service above." |
| Email | "Add a valid email address in To." / "Write a subject or a message before sending." |
| Password | "Enter your current password." / "Use at least 8 characters for the new password." / "The new passwords don’t match." |
| Invite | "Add their name." / "Add a valid email address." |
| Note edit | "A note needs text or an attachment" + "Use Delete to remove it instead" |
