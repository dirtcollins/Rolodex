import { RecordSections } from "@/components/record-sections";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contactById, notesForOpportunity, opportunityById, todosForOpportunity } from "@/lib/data";
import { pickers, todoPick } from "@/lib/pickers";
import { session } from "@/lib/auth";
import { TZ, dayLabel, money, phoneText, telHref } from "@/lib/format";
import { Icon } from "@/components/icons";
import { RecordTodos, Timeline } from "@/components/record-parts";
import { FollowUpCard } from "@/components/follow-ups";
import { OpportunityActions, ProjectCard, StagePill } from "@/components/opportunity-parts";
import { BackLink } from "@/components/back";
import { ReachButtons } from "@/components/reach";
import { ContactAvatar } from "@/components/contact-avatar";
import "../pipeline.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id), o = Number.isSafeInteger(id) ? await opportunityById(id) : null;
  return { title: (o ? o.name : "Project") + " · Rolodex" };
}

// One project's full page (Docs: 5. Pipeline: value, stage, contacts, notes, tasks and history).
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const o = Number.isSafeInteger(id) ? await opportunityById(id) : null;
  if (!o) notFound();
  const [notes, todos, pick, s, person] = await Promise.all([
    notesForOpportunity(id), todosForOpportunity(id), pickers(), session(), o.contact_id ? contactById(o.contact_id) : null,
  ]);
  const closed = o.closed_at && (o.stage === "won" || o.stage === "lost") ? dayLabel(new Date(o.closed_at).toLocaleDateString("en-CA", { timeZone: TZ })) : "";
  return (
    <>
      <BackLink href="/pipeline" label="Pipeline" />
      <div className="record-head" data-kind="opportunity" data-id={o.id} data-name={o.name} data-self="">
        <span className="avatar lg"><Icon name="pipeline" /></span>
        <div style={{ minWidth: 0 }}>
          <h1>{o.name}</h1>
          <p>{o.company || o.contact ? <>
            {o.company_id && o.company && <Link className="link" href={"/companies/" + o.company_id}>{o.company}</Link>}
            {o.company && o.contact && " · "}
            {o.contact_id && o.contact && <Link className="link" href={"/contacts/" + o.contact_id}>{o.contact}</Link>}
          </> : <span className="muted">No company or contact yet</span>}</p>

        </div>
        <OpportunityActions opp={o} names={pick} />
      </div>
      <RecordSections sections={[
{ id: "overview", label: "Overview", content: <><div className="record-overview"><ProjectCard opp={o} />
          <FollowUpCard type="project" id={o.id} name={o.name} next_follow_up={o.next_follow_up} />
          </div><RecordTodos todos={todos} pick={todoPick(pick, s!.user.id)} opportunityId={o.id} /></> },
{ id: "activity", label: "Activity", content: <><Timeline notes={notes} opportunityId={o.id} /></> },
{ id: "people", label: "People and company", content: <div className="record-overview"><div className="card card-pad">
            <h3>Company</h3>
            {o.company_id && o.company ? <div className="linked"><Link href={"/companies/" + o.company_id}><span className="avatar"><Icon name="companies" /></span><span><strong>{o.company}</strong></span></Link></div>
              : <p className="muted" style={{ margin: 0 }}>No company. Add one with Edit.</p>}
          </div>
          <div className="card card-pad">
            <h3>Main contact</h3>
            {person ? <>
              <div className="linked"><Link href={"/contacts/" + person.id}><ContactAvatar id={person.id} name={person.name} /><span><strong>{person.name}</strong>{person.job_title && <small>{person.job_title}</small>}</span></Link></div>
              <ReachButtons big who={{ name: person.name, phones: person.phones, emails: person.emails, log: { contact_id: person.id, opportunity_id: o.id } }} />
              {(person.phones.length > 0 || person.emails.length > 0) && <dl className="facts" style={{ marginTop: 12 }}>
                {person.phones.map((p, i) => <div key={"p" + i}><dt>{p.label || "Phone"}</dt><dd><a href={telHref(p.value)}>{phoneText(p.value)}</a></dd></div>)}
                {person.emails.map((e, i) => <div key={"e" + i}><dt>{e.label || "Email"}</dt><dd><a href={"mailto:" + e.value}>{e.value}</a></dd></div>)}
              </dl>}
            </> : <p className="muted" style={{ margin: 0 }}>No one yet. Pick someone with Edit.</p>}
          </div></div> }
      ]} />
    </>
  );
}
