import { FilterSummary } from "@/components/list-tools";
import Link from "next/link";
import { Suspense } from "react";
import { companyNames, contactNames, listActivities, team, type Activity } from "@/lib/data";
import { ACTIVITY_KINDS, INTERACTIONS, TZ, daysBetween, localDay, stageLabel, today } from "@/lib/format";
import { FilterSearch, FilterSelect } from "@/components/list-tools";
import { LogActivity } from "@/components/activities-parts";
import "./activities.css";

export const metadata = { title: "Activities · Rolodex" };

const PLURAL: Record<string, [string, string]> = {
  call: ["call", "calls"], email: ["email", "emails"], text: ["text", "texts"], meeting: ["meeting", "meetings"], video: ["video call", "video calls"],
  linkedin: ["LinkedIn message", "LinkedIn messages"], introduction: ["introduction", "introductions"], note: ["note", "notes"], observation: ["observation", "observations"],
  interactions: ["interaction", "interactions"],
};
const count = (n: number, k: string) => n + " " + PLURAL[k][n === 1 ? 0 : 1];

const headingFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const headingYearFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });
const clockFormat = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
/** "Today", "Yesterday", "Mon, Oct 13" (with the year when it isn't this one). */
function dayHead(ymd: string, t: string) {
  const n = daysBetween(t, ymd);
  if (n === 0) return "Today";
  if (n === -1) return "Yesterday";
  return (ymd.slice(0, 4) !== t.slice(0, 4) ? headingYearFormat : headingFormat).format(new Date(ymd + "T12:00:00Z"));
}
// A call, email, meeting… is logged by its day only (actions.ts note.add saves it at noon), so only a note shows a clock time.
const timeOf = (a: Activity) => (a.day_only ? "" : clockFormat.format(new Date(a.created_at)));
/** Where an entry opens: the person, else the company, else the project. */
const hrefOf = (a: Activity) => (a.contact_id ? "/contacts/" + a.contact_id : a.company_id ? "/companies/" + a.company_id : a.opportunity_id ? "/pipeline/" + a.opportunity_id : null);

// Activities (Docs: 7. Activities): every call, email, text, meeting, video call, LinkedIn message, introduction and
// note across the Rolodex, by day. Logged here or on a contact's, company's or project's timeline; it's one history.
export default async function Activities({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const kind = sp.kind === "interactions" || ACTIVITY_KINDS.some(([k]) => k === sp.kind) ? sp.kind! : "";
  const days = ["7", "30", "90"].includes(sp.days ?? "") ? Number(sp.days) : undefined;
  const by = Number(sp.by) || undefined;
  const [list, people, contacts, companies] = await Promise.all([listActivities({ kind, author: by, q: sp.q, days }), team(), contactNames(), companyNames()]);

  // "12 interactions and 3 notes in the last 7 days"
  const span = days ? " in the last " + days + " days" : "";
  const talks = list.filter((a) => INTERACTIONS.includes(a.kind)).length;
  const summary = !list.length ? "" : kind ? count(list.length, kind) + span
    : [talks && count(talks, "interactions"), list.length - talks && count(list.length - talks, "note")].filter(Boolean).join(" and ") + span;
  const groups: { day: string; items: Activity[] }[] = [];
  for (const a of list) {
    const d = localDay(a.created_at);
    if (groups.at(-1)?.day === d) groups.at(-1)!.items.push(a); else groups.push({ day: d, items: [a] });
  }
  const filtered = !!(kind || days || by || sp.q), currentDay = today();
  return (
    <>
      <div className="page-head"><div><h1>Activities</h1></div>
        <div className="page-acts"><LogActivity contacts={contacts} companies={companies} /></div></div>
      <div className="toolbar">
        <Suspense>
          <FilterSearch placeholder="Search notes, people, companies" />
          <FilterSelect name="kind" label="What" options={[["", "Everything"], ["interactions", "Interactions"], ...ACTIVITY_KINDS]} />
          <FilterSelect name="by" label="Logged by" options={[["", "Anyone"], ...people.map((p): [string, string] => [String(p.id), p.name])]} />
          <FilterSelect name="days" label="When" options={[["", "Any time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"]]} />
          <span className="grow" />
          {summary && <span className="count">{summary}{list.length >= 500 && " (latest 500)"}</span>}
        </Suspense>
      </div>
      <Suspense><FilterSummary /></Suspense>
      {!list.length && (
        <div className="card empty">{filtered ? <><strong>Nothing matches.</strong>Try another search, or clear the filters above.</> : <><strong>Nothing logged yet.</strong>Log a call, email or meeting here, or on a contact’s page.</>}</div>
      )}
      {groups.map((g) => (
        <section key={g.day} className="act-day">
          <div className="section-title"><h2>{dayHead(g.day, currentDay)}</h2><small>{g.items.length}</small></div>
          <div className="card card-pad">
            <ul className="timeline">
              {g.items.map((a) => {
                const href = hrefOf(a), name = a.about ?? a.company ?? a.project ?? "Note", time = timeOf(a);
                return (
                  <li key={a.id} className={"is-" + a.kind + (href ? " tap" : "")}>
                    {href && <Link className="tap-link" href={href} aria-label={"Open " + name} />}
                    <div className="timeline-meta">
                      {a.kind !== "note" && <span className={"pill " + (a.kind === "observation" ? "is-warn" : "is-accent")}>{stageLabel(ACTIVITY_KINDS, a.kind)}</span>}
                      <strong>{name}</strong>
                      {a.about && a.company_id && <Link href={"/companies/" + a.company_id}>{a.company}</Link>}
                      {(a.about || a.company) && a.opportunity_id && <Link href={"/pipeline/" + a.opportunity_id}>{a.project}</Link>}
                      <span>{[time, a.author].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="timeline-body">{a.body}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </>
  );
}
