"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Popup, toast, useDelete, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { NewContact } from "./new-contact";
import { CompanyForm, type CompanyOptions } from "./company-form";
import type { Pickers } from "./contact-form";
import { MergePopup, MoreMenu } from "./merge";
import { companyQuery } from "./dupes";
import { PickOne } from "./activities-parts";
import { ReachButtons } from "./reach";
import type { Company, Contact } from "@/lib/data";
import { ContactAvatar } from "./contact-avatar";

// The client pieces of a company's page.

/** Add person · Edit · ··· (Merge into…, Delete), at the top of a company. */
export function CompanyActions({ company, pickers, options }: { company: Company; pickers: Pickers; options: CompanyOptions }) {
  const edit = useOpen(), merge = useOpen();
  const router = useRouter(), del = useDelete();
  return (
    <div className="page-acts">
      <NewContact pickers={pickers} company={{ id: company.id, name: company.name }} label="Add person" />
      <button type="button" className="btn" onClick={edit.show}><Icon name="edit" />Edit</button>
      <MoreMenu items={[
        { label: "Merge into…", icon: "merge", onClick: merge.show },
        { label: "Delete", icon: "deleted", bad: true, onClick: () => del("company", company.id, () => router.push("/companies")) },
      ]} />
      {edit.open && <CompanyForm company={company} options={options} onClose={edit.hide} />}
      {merge.open && <MergePopup kind="company" id={company.id} name={company.name} options={pickers.companies} onClose={merge.hide}
        dupeQuery={companyQuery({ name: company.name, website: company.website, not: company.id })} />}
    </div>
  );
}

/**
 * The people at this company. Each opens their contact page; the × takes them off this company (they stay in the
 * Rolodex), with Undo. Below, a small picker adds someone who is already in the Rolodex.
 */
export function CompanyPeople({ company, people, contacts }: { company: Company; people: Contact[]; contacts: { id: number; name: string }[] }) {
  const { run, busy } = useSave();
  const [adding, setAdding] = useState(false), [pick, setPick] = useState(""), [role, setRole] = useState("");
  const others = contacts.filter((p) => !people.some((x) => x.id === p.id));
  const roleOf = (c: Contact) => c.companies.find((x) => x.id === company.id)?.title || c.job_title;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pick && (await run("company.add_person", { company_id: company.id, contact_id: pick, title: role }, "Added")).ok) { setPick(""); setRole(""); setAdding(false); }
  };
  const remove = async (c: Contact) => {
    const title = c.companies.find((x) => x.id === company.id)?.title ?? "";
    if (!(await run("company.remove_person", { contact_id: c.id, company_id: company.id })).ok) return;
    toast(c.name + " taken off " + company.name, false, () => { void run("company.add_person", { company_id: company.id, contact_id: c.id, title }, "Brought back"); });
  };

  return (
    <div className="card card-pad">
      <h3>People</h3>
      {people.length ? <div className="linked">{people.map((c) => (
        <div key={c.id} className="linked-row tap" data-kind="contact" data-id={c.id} data-name={c.name}>
          <Link href={"/contacts/" + c.id} className="tap-link" aria-label={"Open " + c.name} />
          <ContactAvatar id={c.id} name={c.name} /><span className="grow"><strong>{c.name}</strong>{roleOf(c) && <small>{roleOf(c)}</small>}</span>
          <ReachButtons who={{ name: c.name, phones: c.phones, emails: c.emails, log: { contact_id: c.id, company_id: company.id } }} />
          <button type="button" className="icon-btn" aria-label={"Take " + c.name + " off " + company.name} title="Take off this company" onClick={() => remove(c)}><Icon name="close" /></button>
        </div>))}</div>
        : <p className="muted" style={{ margin: 0 }}>No one linked yet.</p>}
      {others.length > 0 && (!adding
        ? <button type="button" className="link" style={{ marginTop: 12, fontSize: 13.5 }} onClick={() => setAdding(true)}>+ Add someone already in the Rolodex</button>
        : <Popup title="Link a person" onClose={() => setAdding(false)} foot={<><span className="grow"/><button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button><button type="submit" form="link-person" className="btn btn-primary" disabled={!pick || busy}>Link person</button></>}><form id="link-person" className="form-grid" onSubmit={add}>
            <PickOne options={others.map((p) => ({ key: String(p.id), name: p.name }))} value={pick} onChange={setPick} label="Who" placeholder="Type a name" autoFocus />
            <input className="in" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role there (optional)" aria-label="Role there" />
          </form></Popup>)}
    </div>
  );
}
