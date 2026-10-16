import { RecordSections } from "@/components/record-sections";
import { LeadCard } from "@/components/lead-card";
import { leadFor } from "@/lib/data";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allIndustries, companyById, listContacts, listOpportunities, listTodos, notesFor, services } from "@/lib/data";
import { pickers, todoPick } from "@/lib/pickers";
import { session } from "@/lib/auth";
import { phoneText, telHref, webHref, webText } from "@/lib/format";
import { RecordTodos, Timeline } from "@/components/record-parts";
import { CompanyActions, CompanyPeople } from "@/components/company-parts";
import { OpportunitiesCard } from "@/components/opportunities-card";
import { BackLink } from "@/components/back";
import { ReachButtons } from "@/components/reach";
import { FollowUpCard } from "@/components/follow-ups";
import { CompanyAvatar } from "@/components/company-avatar";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id), co = Number.isSafeInteger(id) ? await companyById(id) : null;
  return { title: (co ? co.name : "Company") + " · Rolodex" };
}

// A company's full page (Docs: details, people, notes and observations, what they use, what they may need).
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const co = Number.isSafeInteger(id) ? await companyById(id) : null;
  if (!co) notFound();
  const [notes, todos, people, pick, industries, needs, s, projects, lead] = await Promise.all([notesFor({ company: id }), listTodos({ company: id }), listContacts({ company: id }), pickers(), allIndustries(), services(), session(), listOpportunities({ company: id }), leadFor({ company: id })]);
  const place = [co.city, co.state].filter(Boolean).join(", ");
  const address = [co.street, [co.city, [co.state, co.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  return (
    <>
      <BackLink href="/companies" label="Companies" />
      <div className="record-head" data-kind="company" data-id={co.id} data-name={co.name} data-self>
        <CompanyAvatar id={co.id} name={co.name} large eager />
        <div style={{ minWidth: 0 }}>
          <h1>{co.name}</h1>
          <p>{[co.industry, place].filter(Boolean).join(" · ") || <span className="muted">No industry or city yet</span>}</p>
          {(co.needs.length > 0 || co.tags.length > 0) && <div className="tags">{co.tags.map((t) => <Link key={t} className="tag" href={"/companies?tag=" + encodeURIComponent(t)}>{t}</Link>)}</div>}
          <ReachButtons big who={{ name: co.name, phones: co.phone ? [{ label: "Main", value: co.phone }] : [], emails: co.email ? [{ label: "Main", value: co.email }] : [], log: { company_id: co.id } }} />
        </div>
        <CompanyActions company={co} pickers={pick} options={{ industries, services: needs, team: pick.team, tags: pick.tags }} />
      </div>
      <RecordSections sections={[
{ id: "overview", label: "Overview", content: <><div className="record-overview"><FollowUpCard type="company" id={co.id} name={co.name} next_follow_up={co.next_follow_up} />
          
          
          <div className="card card-pad">
            <h3>Details</h3>
            {co.description && <p style={{ margin: "0 0 14px" }}>{co.description}</p>}
            <dl className="facts">
              {co.website && <div><dt>Website</dt><dd><a href={webHref(co.website)} target="_blank" rel="noopener">{webText(co.website)}</a></dd></div>}
              {co.phone && <div><dt>Phone</dt><dd><a href={telHref(co.phone)}>{phoneText(co.phone)}</a></dd></div>}
              {co.email && <div><dt>Email</dt><dd><a href={"mailto:" + co.email}>{co.email}</a></dd></div>}
              {address && <div><dt>{co.street ? "Address" : "Location"}</dt><dd>{address}</dd></div>}
              {co.linkedin && <div><dt>LinkedIn</dt><dd><a href={webHref(co.linkedin)} target="_blank" rel="noopener">{webText(co.linkedin)}</a></dd></div>}
              {co.socials.split("\n").filter((s) => s.trim()).map((s, i) => <div key={"s" + i}><dt>Profile</dt><dd><a href={webHref(s.trim())} target="_blank" rel="noopener">{webText(s.trim())}</a></dd></div>)}
              {co.size && <div><dt>Size</dt><dd>{co.size} people</dd></div>}
              {co.revenue && <div><dt>Revenue</dt><dd>{co.revenue}</dd></div>}
              {co.owner && <div><dt>Looked after by</dt><dd>{co.owner}</dd></div>}
              {!co.description && !co.website && !co.phone && !co.email && !address && !co.linkedin && !co.socials.trim() && !co.size && !co.revenue && !co.owner && <p className="muted" style={{ margin: 0 }}>No details yet. Add them with Edit.</p>}
            </dl>
          </div>
          <div className="card card-pad">
            <h3>What they use</h3>
            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{co.tech || <span className="muted">Not noted yet. Add it with Edit.</span>}</p>
            <h3 style={{ marginTop: 18 }}>May need</h3>
            {co.needs.length ? <div className="tags">{co.needs.map((n) => <span key={n} className="pill is-accent">{n}</span>)}</div> : <p className="muted" style={{ margin: 0 }}>Nothing picked yet.</p>}
          </div>
<RecordTodos todos={todos} pick={todoPick(pick, s!.user.id)} companyId={co.id} />
<LeadCard lead={lead} companyId={co.id} services={needs} team={pick.team} /></div></> },
{ id: "people", label: "People", content: <><CompanyPeople company={co} people={people} contacts={pick.contacts} /></> },
{ id: "projects", label: "Projects", content: <><OpportunitiesCard projects={projects} names={pick} company={{ id: co.id, name: co.name }} /></> },
{ id: "activity", label: "Activity", content: <><Timeline notes={notes} companyId={co.id} observations /></> }
      ]} />
    </>
  );
}
