import "server-only";
import { query } from "./db";
import { followUps } from "./data";
import { TZ, daysBetween, money, today } from "./format";

// The bell (Light Ops 2.0's lib/notifications.ts, brought over 2026-10-15): worked out live from the real records every
// time, never stored. Only each person's "read" and "dismissed" are kept (database/005_bell.sql), by the item's stable
// id ("todo-7-2026-10-15", "note-12"), never rewritten. What it shows (Brendan): your follow-ups and to-dos that are due
// or late, to-dos a teammate gave you, and what teammates did that matters (a project added, Won or Lost, a contact or
// company added, a note or call logged). Never your own actions (Light Ops: "not actions I already know I performed").

const RECENT_DAYS = 21;
/** Light Ops' newest-40: news past it drops off; due follow-ups and to-dos always show. */
const NEWS_MAX = 40;
/** More than this many contacts, companies or notes one person added at once is one row ("Nathan added 120 contacts"). */
const BATCH = 3;

export type Tone = "act" | "wait" | "ok" | "bad" | "done";
interface Note {
  id: string; title: string; body: string; tone: Tone; at: string; href: string; cta: string;
  /** Due follow-ups and to-dos: always in the bell (news is the newest 40). */
  due?: boolean;
}

const cut = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, n).join("") + "…" : s);
const first = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] || "Someone";
const shortDay = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
/** A day at 8 am in Bakersfield as an instant ("2026-10-15" → ISO): when a due item takes its place in the list. */
function dayIso(ymd: string) {
  const guess = new Date(ymd + "T08:00:00Z");
  const off = guess.toLocaleString("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }).match(/GMT([+-]\d+)/)?.[1] ?? "0";
  return new Date(guess.getTime() - Number(off) * 3600000).toISOString();
}
/** Light Ops' when(): "5 min ago", "3 hr ago", "Mon 3:05 PM", "Sep 3, 2026". */
export function bellWhen(at: string) {
  const t = Date.parse(at);
  if (!t) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hr ago";
  const d = new Date(t);
  if (s < 7 * 86400) return d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" }) + " " + d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });
}

const ISO = (col: string) => `to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
const SAID: Record<string, string> = {
  note: "added a note on", observation: "added an observation on", call: "logged a call with", email: "logged an email with",
  text: "logged a text with", meeting: "logged a meeting with", video: "logged a video call with", linkedin: "logged a LinkedIn message with",
  introduction: "logged an introduction for",
};

/** Rows (newest first) split into bursts: one person's, each within 2 minutes of the next. Newest first inside too. */
function bursts<T extends { by_id: number; at: string }>(rows: T[]): T[][] {
  const out: T[][] = [], last = new Map<number, T[]>();
  for (const r of rows) {
    const g = last.get(r.by_id);
    if (g && Date.parse(g[g.length - 1].at) - Date.parse(r.at) <= 120_000) g.push(r);
    else { const n = [r]; out.push(n); last.set(r.by_id, n); }
  }
  return out;
}

/** Everything this person's bell could show, newest first (not yet cut to the newest 40, nor read or dismissed). */
async function notes(me: number): Promise<Note[]> {
  const t = today();
  const [due, owners, todos, given, teamNotes, people, firms, projects] = await Promise.all([
    followUps(0),
    // Whose follow-up it is: the record's owner. One with no owner is everyone's (a project has none).
    query<{ kind: string; id: number; owner: number | null }>(`select 'contact' as kind, id::int, owner_id::int as owner from contacts where deleted_at is null and owner_id is not null
      union all select 'company', id::int, owner_id::int from companies where deleted_at is null and owner_id is not null`),
    // Your to-dos that are due or late: given to you, or unassigned ones you made.
    query<{ id: number; title: string; due: string; high: boolean }>(`select id::int, title, due::text, high from todos
      where deleted_at is null and done_at is null and due <= $2::date and (assigned_to = $1 or (assigned_to is null and created_by = $1))`, [me, t]),
    // To-dos a teammate gave you in the last 3 weeks, still open.
    query<{ id: number; title: string; due: string | null; by: string | null; at: string }>(`select t.id::int, t.title, t.due::text, u.name as by, ${ISO("t.assigned_at")} as at
      from todos t left join users u on u.id = t.assigned_by
      where t.deleted_at is null and t.done_at is null and t.assigned_to = $1 and t.assigned_by is not null and t.assigned_by <> $1
        and t.assigned_at >= now() - interval '${RECENT_DAYS} days' order by t.assigned_at desc limit 30`, [me]),
    // Notes, calls, meetings… a teammate logged on a record.
    query<{ id: number; kind: string; body: string; by_id: number; by: string | null; at: string; contact_id: number | null; company_id: number | null; opportunity_id: number | null; about: string | null }>(`
      select n.id::int, n.kind, n.body, n.author_id::int as by_id, u.name as by, ${ISO("n.created_at")} as at, c.id::int as contact_id, co.id::int as company_id, o.id::int as opportunity_id,
        coalesce(nullif(trim(c.first_name || ' ' || c.last_name), ''), co.name, o.name) as about
      from notes n left join users u on u.id = n.author_id
        left join contacts c on c.id = n.contact_id and c.deleted_at is null left join companies co on co.id = n.company_id and co.deleted_at is null
        left join opportunities o on o.id = n.opportunity_id and o.deleted_at is null
      where n.deleted_at is null and n.author_id is not null and n.author_id <> $1 and n.created_at >= now() - interval '${RECENT_DAYS} days'
        and coalesce(c.id, co.id, o.id) is not null
      order by n.created_at desc, n.id desc limit 3000`, [me]),
    // Contacts and companies a teammate added.
    query<{ id: number; name: string; sub: string; by_id: number; by: string | null; at: string }>(`
      select c.id::int, trim(c.first_name || ' ' || c.last_name) as name, c.job_title as sub, c.created_by::int as by_id, u.name as by, ${ISO("c.created_at")} as at
      from contacts c left join users u on u.id = c.created_by
      where c.deleted_at is null and c.created_by is not null and c.created_by <> $1 and c.created_at >= now() - interval '${RECENT_DAYS} days' order by c.created_at desc, c.id desc limit 3000`, [me]),
    query<{ id: number; name: string; sub: string; by_id: number; by: string | null; at: string }>(`
      select co.id::int, co.name, concat_ws(' · ', nullif(co.industry, ''), nullif(co.city, '')) as sub, co.created_by::int as by_id, u.name as by, ${ISO("co.created_at")} as at
      from companies co left join users u on u.id = co.created_by
      where co.deleted_at is null and co.created_by is not null and co.created_by <> $1 and co.created_at >= now() - interval '${RECENT_DAYS} days' order by co.created_at desc, co.id desc limit 3000`, [me]),
    // Projects a teammate added, or moved to Won or Lost.
    query<{ id: number; name: string; stage: string; value: number; company: string | null; created_by: number | null; added_by: string | null; added_at: string; closed_by: number | null; closed_name: string | null; closed_at: string | null; recent: boolean }>(`
      select o.id::int, o.name, o.stage, o.value_cents::float8 as value, co.name as company, o.created_by::int, a.name as added_by, ${ISO("o.created_at")} as added_at,
        o.closed_by::int, b.name as closed_name, ${ISO("o.closed_at")} as closed_at, o.created_at >= now() - interval '${RECENT_DAYS} days' as recent
      from opportunities o left join companies co on co.id = o.company_id and co.deleted_at is null
        left join users a on a.id = o.created_by left join users b on b.id = o.closed_by
      where o.deleted_at is null and ((o.created_by <> $1 and o.created_at >= now() - interval '${RECENT_DAYS} days')
        or (o.stage in ('won', 'lost') and o.closed_by <> $1 and o.closed_at >= now() - interval '${RECENT_DAYS} days'))`, [me]),
  ]);
  const out: Note[] = [];
  const ownerOf = new Map(owners.map((o) => [o.kind + "-" + o.id, o.owner]));
  const open = { contact: "Open contact", company: "Open company", project: "Open project" } as const;

  // Your follow-ups due today or late (Dashboard's "Who to contact"). The id carries the due day, so a new follow-up
  // date is a new notification; a keep-in-touch reminder with no touch logged yet has no day of its own.
  for (const f of due) {
    const owner = ownerOf.get(f.type + "-" + f.id);
    if (owner && owner !== me) continue;
    const never = f.touch && f.why.startsWith("Keep in touch");
    out.push({ id: "follow-" + f.type + "-" + f.id + "-" + (never ? "touch" : f.due), due: true, tone: f.tone === "late" ? "bad" : "act", at: dayIso(f.due),
      title: (f.touch ? "Keep in touch with " : "Follow up with ") + f.name, body: [f.why, f.sub].filter(Boolean).join(" · "), href: f.href, cta: open[f.type] });
  }
  // Your to-dos when they come due (Light Ops').
  for (const x of todos) {
    const late = x.due < t, n = daysBetween(x.due, t);
    out.push({ id: "todo-" + x.id + "-" + x.due, due: true, tone: late ? "bad" : "act", at: dayIso(x.due), title: x.title, href: "/todos", cta: "Open to-dos",
      body: (late ? "Overdue since " + shortDay(x.due) + (n > 1 ? " · " + n + " days" : "") : "Due today") + (x.high ? " · High priority" : "") });
  }
  for (const x of given) out.push({ id: "todogiven-" + x.id, tone: "act", at: x.at, title: first(x.by) + " gave you a to-do",
    body: x.title + (x.due ? " · due " + shortDay(x.due) : ""), href: "/todos", cta: "Open to-dos" });

  // What teammates did. Many at once (an import, a prospect list, research notes) is one row, so it doesn't bury
  // everything else; its id is the burst's first record, so it stays the same as the burst is read again.
  for (const g of bursts(teamNotes)) {
    if (g.length > BATCH) {
      const people = new Set(g.map((x) => x.about)).size;
      out.push({ id: "notes-added-" + g[g.length - 1].id, tone: "done", at: g[0].at, title: first(g[0].by) + " added " + g.length + " notes" + (people > 1 ? " on " + people + " records" : " on " + (g[0].about || "a record")),
        body: [...new Set(g.map((x) => x.about))].slice(0, 3).join(", ") + (people > 3 ? "…" : ""), href: "/activities", cta: "Open activities" });
      continue;
    }
    for (const x of g) {
      const [href, cta] = x.contact_id ? ["/contacts/" + x.contact_id, open.contact] : x.company_id ? ["/companies/" + x.company_id, open.company] : ["/pipeline/" + x.opportunity_id, open.project];
      out.push({ id: "note-" + x.id, tone: "done", at: x.at, title: first(x.by) + " " + (SAID[x.kind] ?? SAID.note) + " " + (x.about || "a record"), body: cut(x.body.replace(/\s+/g, " ").trim(), 90), href, cta });
    }
  }
  const added = (rows: typeof people, kind: "contact" | "company") => {
    for (const g of bursts(rows)) {
      if (g.length > BATCH) {
        out.push({ id: (kind === "contact" ? "contacts" : "companies") + "-added-" + g[g.length - 1].id, tone: "done", at: g[0].at, title: first(g[0].by) + " added " + g.length + (kind === "contact" ? " contacts" : " companies"),
          body: g.slice(0, 3).map((r) => r.name).join(", ") + "…", href: (kind === "contact" ? "/contacts" : "/companies") + "?sort=recent", cta: kind === "contact" ? "See contacts" : "See companies" });
      } else for (const r of g) out.push({ id: kind + "-" + r.id, tone: "done", at: r.at, title: first(r.by) + " added " + r.name, body: r.sub || (kind === "contact" ? "New contact" : "New company"),
        href: (kind === "contact" ? "/contacts/" : "/companies/") + r.id, cta: open[kind] });
    }
  };
  added(people, "contact");
  added(firms, "company");
  for (const p of projects) {
    const body = [p.company, p.value ? money(p.value) : ""].filter(Boolean).join(" · ") || "Project";
    if (p.recent && p.created_by !== me) out.push({ id: "project-" + p.id, tone: "wait", at: p.added_at, title: first(p.added_by) + " added a project: " + p.name, body, href: "/pipeline/" + p.id, cta: open.project });
    if ((p.stage === "won" || p.stage === "lost") && p.closed_by && p.closed_by !== me && p.closed_at)
      out.push({ id: p.stage + "-" + p.id, tone: p.stage === "won" ? "ok" : "done", at: p.closed_at, title: first(p.closed_name) + " moved " + p.name + " to " + (p.stage === "won" ? "Won" : "Lost"), body, href: "/pipeline/" + p.id, cta: open.project });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** The bell: newest first; due follow-ups and to-dos always, the rest up to 40; not the ones this person dismissed. */
export async function bell(me: number) {
  const [all, reads, gone] = await Promise.all([notes(me), query<{ id: string }>("select note_id as id from bell_reads where user_id = $1", [me]),
    query<{ id: string }>("select note_id as id from bell_dismissals where user_id = $1", [me])]);
  const read = new Set(reads.map((r) => r.id)), dismissed = new Set(gone.map((r) => r.id));
  const shown = all.filter((x) => !dismissed.has(x.id));
  const news = new Set(shown.filter((x) => !x.due).slice(0, NEWS_MAX));
  const rows = shown.filter((x) => x.due || news.has(x)).map((x) => ({ id: x.id, title: x.title, body: x.body, tone: x.tone, at: x.at, when: bellWhen(x.at), href: x.href, cta: x.cta, read: read.has(x.id) }));
  return { rows, unread: rows.filter((r) => !r.read).length };
}
export type BellRow = Awaited<ReturnType<typeof bell>>["rows"][number];

/**
 * The bell's saves (Light Ops'), kept for this person in the database so they hold on every device and after any
 * release: read (a row opened), read-all (Mark all read: everything the bell could show, older ones past its 40 too),
 * dismiss, dismiss-all (Clear all) and undismiss (Undo). Ids are kept exactly as the bell made them. Answers the ids a
 * dismiss-all took, for Undo.
 */
export async function bellSave(me: number, action: string, ids: string[]): Promise<string[]> {
  const all = action === "read-all" || action === "dismiss-all";
  const list = all ? (await notes(me)).map((x) => x.id) : ids.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 200).slice(0, 2000);
  if (!list.length) return [];
  if (action === "read" || action === "read-all")
    await query("insert into bell_reads (user_id, note_id) select $1, json_array_elements_text($2::text::json) on conflict do nothing", [me, JSON.stringify(list)]);
  else if (action === "dismiss" || action === "dismiss-all")
    return (await query<{ id: string }>("insert into bell_dismissals (user_id, note_id) select $1, json_array_elements_text($2::text::json) on conflict do nothing returning note_id as id", [me, JSON.stringify(list)])).map((r) => r.id);
  else if (action === "undismiss")
    await query("delete from bell_dismissals where user_id = $1 and note_id in (select json_array_elements_text($2::text::json))", [me, JSON.stringify(list)]);
  return [];
}
