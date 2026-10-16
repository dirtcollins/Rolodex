import { RecordSections } from "@/components/record-sections";
import { LeadCard } from "@/components/lead-card";
import { leadFor, services } from "@/lib/data";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contactById, introducedBy, listOpportunities, listTodos, notesFor, relationshipsFor } from "@/lib/data";
import { pickers, todoPick } from "@/lib/pickers";
import { session } from "@/lib/auth";
import { dayLabel, kindLabel, phoneText, telHref, webHref, webText } from "@/lib/format";
import { Icon } from "@/components/icons";
import { ContactActions, FollowUp, RecordTodos, Timeline } from "@/components/record-parts";
import { OpportunitiesCard } from "@/components/opportunities-card";
import { BackLink } from "@/components/back";
import { ReachButtons } from "@/components/reach";
import { RelationshipsCard } from "@/components/relationships-card";
import { ContactAvatar } from "@/components/contact-avatar";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id), c = Number.isSafeInteger(id) ? await contactById(id) : null;
  return { title: (c ? c.name : "Contact") + " · Rolodex" };
}

// A contact's full page (Docs: details, conversations, companies, relationships, tasks; opportunities in Phase 3).
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = Number.isSafeInteger(id) ? await contactById(id) : null;
  if (!c) notFound();
  const [notes, todos, introduced, pick, s, projects, relations, lead, needs] = await Promise.all([notesFor({ contact: id }), listTodos({ contact: id }), introducedBy(id), pickers(), session(), listOpportunities({ contact: id }), relationshipsFor(id), leadFor({ contact: id }), services()]);
  const place = [c.city, c.state].filter(Boolean).join(", ");
  return (
    <>
      <BackLink href="/contacts" label="Contacts" />
      <div className="record-head" data-kind="contact" data-id={c.id} data-name={c.name} data-self>
        <ContactAvatar id={c.id} name={c.name} large eager />
        <div style={{ minWidth: 0 }}>
          <h1>{c.name}</h1>
          <p>{[c.job_title, c.companies.map((x) => x.name).join(", ")].filter(Boolean).join(" at ") || <span className="muted">No title or company yet</span>}</p>
          {(c.kinds.length > 0 || c.tags.length > 0) && <div className="tags">{c.kinds.map((k) => <span key={k} className="pill is-accent">{kindLabel(k)}</span>)}{c.tags.map((t) => <Link key={t} className="tag" href={"/contacts?tag=" + encodeURIComponent(t)}>{t}</Link>)}</div>}
          <ReachButtons big who={{ name: c.name, phones: c.phones, emails: c.emails, log: { contact_id: c.id } }} />
        </div>
        <ContactActions contact={c} pickers={pick} />
      </div>
      <RecordSections sections={[
{ id: "overview", label: "Overview", content: <><div className="record-overview"><FollowUp contact={c} />
          
          <div className="card card-pad">
            <h3>Details</h3>
            <dl className="facts">
              {c.emails.map((e, i) => <div key={"e" + i}><dt>{e.label || "Email"}</dt><dd><a href={"mailto:" + e.value}>{e.value}</a></dd></div>)}
              {c.phones.map((p, i) => <div key={"p" + i}><dt>{p.label || "Phone"}</dt><dd><a href={telHref(p.value)}>{phoneText(p.value)}</a></dd></div>)}
              {c.website && <div><dt>Website</dt><dd><a href={webHref(c.website)} target="_blank" rel="noopener">{webText(c.website)}</a></dd></div>}
              {c.linkedin && <div><dt>LinkedIn</dt><dd><a href={webHref(c.linkedin)} target="_blank" rel="noopener">{webText(c.linkedin)}</a></dd></div>}
              {c.socials.split("\n").filter(Boolean).map((s, i) => <div key={"s" + i}><dt>Profile</dt><dd><a href={webHref(s.trim())} target="_blank" rel="noopener">{webText(s.trim())}</a></dd></div>)}
              {place && <div><dt>Location</dt><dd>{place}</dd></div>}
              {c.birthday && <div><dt>Birthday</dt><dd>{dayLabel(c.birthday)}</dd></div>}
              {c.owner && <div><dt>Looked after by</dt><dd>{c.owner}</dd></div>}
              {!c.emails.length && !c.phones.length && !c.website && !place && <p className="muted" style={{ margin: 0 }}>No contact details yet.</p>}
            </dl>
          </div>
          <div className="card card-pad">
            <h3>Companies</h3>
            {c.companies.length ? <div className="linked">{c.companies.map((x) => (
              <Link key={x.id} href={"/companies/" + x.id}><span className="avatar"><Icon name="companies" /></span><span><strong>{x.name}</strong>{x.title && <small>{x.title}</small>}</span></Link>))}</div>
              : <p className="muted" style={{ margin: 0 }}>Not linked to a company. Add one with Edit.</p>}
          </div>
          <div className="card card-pad">
            <h3>How we know them</h3>
            <dl className="facts">
              <div><dt>How we met</dt><dd>{c.how_met || <span className="muted">Not noted</span>}</dd></div>
              <div><dt>Introduced by</dt><dd>{c.introduced_by ? <Link className="link" href={"/contacts/" + c.introduced_by}>{c.introducer}</Link> : <span className="muted">Nobody noted</span>}</dd></div>
              {introduced.length > 0 && <div><dt>Introduced us to</dt><dd>{introduced.map((p, i) => <span key={p.id}>{i > 0 && ", "}<Link className="link" href={"/contacts/" + p.id}>{p.name}</Link></span>)}</dd></div>}
            </dl>
          </div>
          
<RecordTodos todos={todos} pick={todoPick(pick, s!.user.id)} contactId={c.id} />
<LeadCard lead={lead} contactId={c.id} services={needs} team={pick.team} /></div></> },
{ id: "activity", label: "Activity", content: <><Timeline notes={notes} contactId={c.id} /></> },
{ id: "projects", label: "Projects", content: <><OpportunitiesCard projects={projects} names={pick} contact={{ id: c.id, company: c.companies[0] && { id: c.companies[0].id, name: c.companies[0].name } }} /></> },
{ id: "connections", label: "Connections", content: <><RelationshipsCard contactId={c.id} relations={relations} people={pick.contacts} /></> }
      ]} />
    </>
  );
}
