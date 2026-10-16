# Rolodex 2.0 UI Audit and Redesign Plan

October 15, 2026 · Prepared for Brendan Collins · Review before implementation

Rolodex should make the next conversation easy to find and every relationship easy to understand. The existing application has useful shared infrastructure, but its page hierarchy, record layouts, and interaction rules need a coordinated redesign. The proposed direction is a calm Collins Creative workspace with readable typography, restrained blue actions, compact navigation, full record pages, centered dialogs, and subtle toasts.

This proposal covers the existing application. It preserves the current contact and company model, relationships, histories, sales stages, imports, and communication workflows.

## Audit scope and baseline

All 22 page definitions were reviewed, along with the shared shell, navigation, search, dialogs, toasts, forms, record interactions, data access layer, save actions, and seven database migration files. Nineteen authenticated page templates were inspected in the existing browser application, including contact, company, opportunity, and campaign details. The root redirect, sign-in form, and legacy Coming Soon route were reviewed in source. Local sign-in bypass redirects the login page to the dashboard.

Desktop inspection included the existing wide browser window and a 1440 × 900 viewport. Mobile inspection covered all authenticated page templates at 390 × 844. Keyboard checks included record navigation, dialog cancellation, and Tab containment. Dark mode was reviewed through its CSS tokens and contrast calculations; a rendered dark-mode review and physical touch-device testing remain implementation acceptance checks. Responsive emulation does not establish touch behavior.

The TypeScript baseline passed with `tsc --noEmit --incremental false`. The existing server on port 4600 remained the only server. No build or second database process was started. No record saves, imports, deletions, restores, email sends, or text sends were performed. A test-record Call control opened a browser protocol prompt during hit-area inspection; the prompt was canceled without opening Phone, and the unsaved logging prompt was dismissed.

The project has no Git repository at the current app location. Before implementation, preserve a source snapshot. A raw database backup must use a clean shutdown of the sole server or a consistent export through the existing database process; do not copy a changing PGlite directory as though it were a reliable backup.

## What should be retained

The application already supports full record pages, shared popup and toast components, quick contact creation, duplicate checks, soft deletion with Undo, and linked histories. Contacts can belong to multiple companies. Leads reference a person or company; opportunities describe specific projects. Notes and tasks connect to those records. These relationships should remain intact.

List filters and sorting use URLs and cookies. Contextual record navigation uses a per-tab history trail with scroll memory. The tested company → contact → company return worked, and the company retained its filtered-list destination. This is existing behavior to strengthen and regression-test.

Pipeline movement already has optimistic updates with rollback, pointer dragging, and a stage-select alternative. Notifications also update optimistically. Reduced-motion rules and system-based light/dark tokens already exist. These foundations allow the redesign to reuse the backend and improve the frontend incrementally.

## Findings by priority

| Priority | Finding and evidence | Required improvement |
| --- | --- | --- |
| First | Dialog focus escapes to the underlying page. Tabbing after Save in the contact editor focused a background activity radio. The shared popup sets `aria-modal` but does not trap focus or make the background inert. | Use an accessible dialog primitive, contain focus, restore it to the trigger, and make the background inactive. |
| First | The expanded contact editor exceeds the desktop viewport. At 1440 × 900 its measured bottom was about 1268px, leaving the footer below the initial view. | Limit dialog height, scroll the body internally, and keep the header and actions visible. Position short dialogs slightly above center. |
| First | Recently Deleted overflows horizontally. At a 390px mobile width, the document measured 784px wide and Restore controls extended offscreen. | Constrain long text, allow flex/grid children to shrink, and keep Restore reachable. |
| First | Contacts headers do not align with row data. At 1440px, the Company heading started near x=682 while its row cell started near x=641. The header's automatic action column collapsed to approximately 0px while the row reserved about 114px. | Share explicit column definitions between headers and rows; use semantic table markup where appropriate. |
| First | The lead editing path is incomplete. Leads opens its associated company/contact, but neither record page mounts the existing `LeadCard`. Its edit controls are therefore absent from the destination. | Expose existing lead facts and Edit lead within the full record page without creating a duplicate record. |
| First | Parts of the interface exceed the requested three primary patterns: an anchored notification tray, a floating selection toolbar, a floating communication-log prompt, and narrow stacks of record cards at the right. | Use centered dialogs for quick actions, in-page selection controls, and full-width record sections. Treat standard selects, date inputs, and small control menus as controls rather than additional record surfaces. |
| Next | The dashboard gives eight statistic cards priority over daily work. On mobile, “Who should I contact today?” started near y=727, and My to-dos near y=2089. | Lead with due work and tasks. Reduce metrics to one compact supporting summary. |
| Next | Mobile record hierarchy hides useful facts beneath the activity feed. On the test contact, Follow-up began near y=1677 and Details near y=2213. | Show identity, contact methods, next action, and key relationships before the history. |
| Next | Creation and editing vary between modals, inline composers, expanded forms, and full-page settings forms. Contact quick-add is concise, but editing exposes a long field list at once. | Standardize centered create/edit dialogs with clearly grouped fields and progressive disclosure. Keep major workflows such as import and campaign composition on full pages. |
| Next | Action density and duplication weaken hierarchy. Record pages repeat stage/value/dates; company needs appear twice; timelines expose many activity choices and per-note controls simultaneously. | Show each fact once, give each page one primary action, and reveal secondary actions on demand with keyboard/touch access. |
| Next | Dark primary-button text has insufficient contrast for small labels. White on the current dark accent `#2997ff` computes to approximately 3.02:1. Some small muted text is also weak: `#86868b` on white is approximately 3.62:1. | Choose separate action-fill and action-text tokens for each theme and verify all actual foreground/background pairs. |
| Next | Feedback is inconsistent. General saves refresh server data; to-do completion waits for the save, while pipeline movement is optimistic. Global search silently retains results when a request fails. The single toast slot replaces earlier messages and Undo actions. | Apply optimistic updates to safe, reversible actions with rollback; preserve valid search results while clearly reporting failures; keep Undo available when messages arrive close together. |
| Next | Unsaved forms close immediately on Escape or backdrop click. Filter-search local state is initialized from the URL without explicit synchronization when query parameters change externally. | Protect meaningful drafts and test query/history synchronization across Back, Forward, and same-page navigation. |
| Later | List pages render large batches without pagination: contacts/companies up to 2000, leads up to 3000, and activities up to 500. Counts often represent the returned batch. No custom route loading/error/not-found files are present. | Measure browser and server work, introduce honest counts and incremental loading where needed, and provide stable recovery states. Avoid speculative backend rewrites. |

Clicking the center of the stretched test-person link activated the overlaid Call control. This establishes a collision between the link's rectangle and an independent action, rather than proving every card is broken. The replacement row component needs separate, deliberate hit areas and mouse/keyboard/touch coverage.

## Proposed design direction

Reading this as a relationship-focused desktop and mobile product for Collins Creative, with a quiet, precise visual language and useful information density.

Retain the Collins Creative wordmark and blue identity. Use neutral surfaces, fewer enclosing cards, clearer section spacing, and a system sans-serif suited to daily reading. Apple’s modality guidance supports focused tasks with explicit dismissal; Anthropic’s design guidance emphasizes deliberate typography, color, and cohesive visual choices. These are reference principles; the following specification is a proposal for Rolodex. See [Apple modality guidance](https://developer.apple.com/design/human-interface-guidelines/modality) and [Anthropic frontend design guidance](https://claude.com/resources/articles/improving-frontend-design-through-skills).

| Element | Proposed standard |
| --- | --- |
| Typography | System sans-serif; 15px body, 13px secondary labels, 28–32px page titles, 18–20px section titles. Avoid faint text for essential facts. |
| Spacing | A 4px base with 8, 12, 16, 24, and 32px increments. Consistent page gutters and section rhythm. |
| Light theme | Near-white workspace, white content surfaces, neutral gray borders, dark ink, restrained blue actions. |
| Dark theme | Charcoal workspace and elevated neutral surfaces, warm-white text, brighter blue links, and contrasting text on filled actions. Replace the present pervasive navy tint. |
| Controls | 36–40px desktop controls; 44px touch targets. Inputs and buttons use an 8–10px radius; dialogs use 16px. Reserve pills for statuses and compact segmented choices. |
| Layout | Adaptive content widths: broader lists and pipeline, narrower readable record pages. Align content deliberately within the available workspace. |
| Motion | Short 120–180ms state transitions; no page entrance choreography. Respect reduced motion. |
| Accessibility | Visible focus, semantic labels and tables, predictable Tab order, readable contrast, inactive modal backgrounds, and non-drag alternatives. |

The shell should retain familiar primary destinations: Dashboard, Follow-ups, Contacts, Companies, To-dos, and Pipeline. Remove unnecessary count badges; prioritize counts that indicate work requiring attention. Leads, Network, Activities, and Outreach should be redesigned as part of this scope while their navigation visibility remains a separate product decision. They are currently intentionally hidden in `areas.ts`.

Global search should open a centered command-style popup on desktop and use the same dialog model adapted to mobile. Notifications should use a centered popup. Bulk selection should occupy the list’s own toolbar. Quick logging should use the shared dialog, with toasts reserved for feedback.

Record pages should use a single full-page hierarchy: contextual back link, identity and actions, a compact next-action summary, then clearly named in-page sections. Proposed sections are Overview, Activity, and related work or people as appropriate. Tabs are navigation within the full page and must retain meaningful URLs. Essential facts should remain visible before a long history on mobile. No right-side inspector or stack of narrow supporting panels is needed.

## Page by page redesign

| Existing page | Audit conclusion | Proposed organization |
| --- | --- | --- |
| Dashboard | Useful work is subordinate to eight metric cards. | Due and overdue conversations first, open tasks next, a compact sales summary, then secondary recent activity. |
| Contacts | Search and filters work, but headers misalign, rows repeat disabled communication controls, and mobile hides follow-up facts. | Aligned semantic list/table, readable name/company, next follow-up retained on mobile, consistent row actions, clear active filters and reset. |
| Contact record | Full-page identity and contextual Back are present; facts and relationships are scattered through side cards. | Overview with contact methods and next action; Activity history; clearly grouped companies, connections, and projects within the page. Edit and Log activity use shared dialogs. |
| Companies | Familiar directory, but long industry choices and missing values dominate scanning. | Clear company/location/relationship columns, concise filters, honest empty states, and whole-row opening. |
| Company record | People and useful facts follow a large composer; needs repeat. | Company overview and next action, People and Projects sections, Activity history, one place for needs and existing software. Add/link person through a centered dialog. |
| Follow-ups | Due-date grouping is useful; each row carries several equal-weight actions. | Retain Late, Today, This week, Later. Emphasize who, why, and the due date, with consistent Done/reschedule logging. Keep distinct person/project follow-ups distinguishable. |
| To-dos | Supports grouping and Undo; quick entry competes with New to-do and each row exposes deletion. | A focused task list with clear due context, one creation entry point, immediate completion with rollback, and modal editing. |
| Pipeline | Board/list and optimistic movement are strong foundations; metrics consume space and card stage controls are visually hidden. | Compact totals, clearer project cards, discoverable move actions, board/list parity, and a useful single-stage mobile view. Preserve the existing six stages. |
| Opportunity record | Stage, value, and dates repeat in header and side card; many primary-looking actions compete. | Compact commercial summary, one clear stage control, next follow-up, relationships, tasks, and history within full-page sections. Edit uses a dialog. |
| Leads | Excessive stage chips/filter choices; record destination omits lead controls. | Condensed stage navigation, common filters first with advanced filters in a centered popup, consistent bulk toolbar, and complete lead editing on the linked person/company page. |
| Activities | Date grouping is helpful; a large day can produce an extremely long feed. | A readable chronological feed with concise previews, reliable record links, focused filtering, and incremental loading as justified by measurements. Log activity in a centered popup. |
| Network | Basic relationship information is useful without a complex graph. | Clear connections and introductions list, concise referral summary, full contact navigation, and centered connection editing. |
| Outreach | Campaigns, recent messages, and templates compete across columns. | Clearly separated in-page views for campaigns, templates, and history with consistent record/action patterns. Preserve manual reply-status workflow. |
| Campaign record | Composition, narrow preview, recipients, and manual statuses are available. | Full-page composition with a readable in-page preview and recipients section; retain explicit send confirmation. No sending during design verification. |
| Settings | Team and services are simple, but full-page service editing differs from modal team editing. | Calm Team and Services sections with consistent edit dialogs. Maintain current owner permissions. |
| My account | Profile and password fields share one form and compete with account summary. | Read-only account overview with separate centered profile and password dialogs; preserve existing authentication behavior. |
| Import | Initial file choice is clear; later mapping, progress, and partial-success recovery need consistent treatment. | A full-page Choose file → Review mapping → Import result workflow. Keep duplicate rules and batch semantics. Test later with synthetic data only. |
| Recently Deleted | Long titles break mobile width; deletion types and recovery promises are inconsistent. | Constrained readable rows, record/type context, visible Restore, and accurate recovery copy. Reconcile campaign/template Undo support with their absence from the current recovery list. |
| More | Mobile directory repeats destinations already in the bottom navigation. | Show secondary destinations and account actions in a simple full page. Keep mobile navigation predictable. |
| Sign in | Simple source-level form; bypass prevents local live inspection of it. | Apply shared typography, fields, focus, and validation styles. Verify in an isolated authentication test setup later. |
| Root | Redirects to Dashboard. | Retain redirect. |
| Coming Soon | Legacy route currently has no matching navigation entry and resolves to not-found. | Preserve valid behavior while replacing generic not-found handling; add no placeholder destinations. |

## Implementation order after review

1. **Preserve the baseline.** Take a source snapshot, retain one server, record existing list preferences, and establish navigation and relationship checks against the approved test records. Make no schema changes for this redesign.
2. **Build the shared design system and shell.** Define light/dark tokens, typography, spacing, controls, headers, list columns, responsive layouts, dialogs, and toasts in the existing React/CSS stack. Start with the modal focus/sizing and mobile-width defects. Evaluate native dialog behavior before adding a library. Avoid a wholesale framework replacement.
3. **Redesign Contacts and Companies together.** Establish the reusable list and full record templates. Complete quick-add/edit dialogs, company linking, timeline presentation, contextual Back, and search/filter restoration. Use these pages to settle the design details before propagating them.
4. **Redesign daily work.** Apply the components to Dashboard, Follow-ups, and To-dos. Make safe reversible actions immediate, with disabled repeat submission, rollback, and durable Undo feedback.
5. **Redesign sales and relationship screens.** Update Pipeline and opportunity details, then Leads, Activities, Network, Outreach, and campaign details. Reconnect existing lead editing and preserve stages and communications semantics.
6. **Finish workspace pages and verify the whole application.** Update Settings, account, import, recovery, More, sign-in, and error/empty/loading states. Check both themes and all relevant input modes before calling the redesign complete.

Frontend changes should continue using the existing save actions and data relationships. Change data-query contracts only when an interface improvement needs them, such as accurate pagination totals. Any performance work should follow measurements from realistic navigation and mutations.

## Acceptance checks

| Area | Completion evidence |
| --- | --- |
| Contextual navigation | Filter/search/sort list → company → person → Back returns through the expected pages, preserving query and practical scroll position; direct links have a sensible fallback. |
| Record interactions | Click name, whitespace, and keyboard link separately; independent action controls trigger only their intended action. Test on mouse, keyboard, and touch. |
| Dialogs | Short and long forms fit at desktop, tablet, and phone sizes; keyboard stays inside; Escape/backdrop behavior protects drafts; focus returns correctly; footer actions remain accessible with the mobile keyboard. |
| Forms | Validation identifies the relevant field, duplicate warnings remain intact, failed saves retain input, and rapid double-clicks cannot create duplicate submissions. |
| Safe updates | Task completion, stage movement, and rescheduling respond immediately where safe, roll back on failure, and stay correct under consecutive actions. |
| Themes and motion | All pages and states render in light and dark; essential small text meets 4.5:1 contrast; visible focus and reduced motion work. |
| Responsive pages | Check 390px phone, 768px tablet, 1440px desktop, and a wide desktop. No page-level horizontal overflow; intentional pipeline scrolling stays within its container. |
| Data | Existing IDs, company links, introductions, notes, tasks, amounts, stages, and communication history remain intact. Saves and mutations use only tagged Test data or Derek Sample. |
| Communication | Do not send email/text to real contacts. Composition and send confirmation can be inspected without submitting. |
| Recovery and performance | Empty, failure, pending, and recovery states are understandable. Record navigation and list interaction are profiled; no production speed claim is based on development compilation timings. |

The review decision is whether this visual direction, page organization, and implementation sequence match the intended Rolodex 2.0. Application implementation starts after that review.
