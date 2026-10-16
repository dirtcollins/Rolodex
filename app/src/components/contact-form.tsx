"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popup, useSave } from "./ui";
import { DupeNotice, companyMatch, contactQuery, useDupes } from "./dupes";
import { CADENCES, KINDS } from "@/lib/format";
import type { Contact, Labeled } from "@/lib/data";
import { Autocomplete } from "./autocomplete";

export type Pickers = { companies: { id: number; name: string }[]; contacts: { id: number; name: string }[]; team: { id: number; name: string }[]; tags: string[] };

type Row = { id?: number; name: string; title: string };

/**
 * New contact and Edit (Docs: "Add contacts quickly with minimal required fields"): name, company, title, email and
 * phone first; everything else under More details, open when editing.
 * Quick add (Brendan, 2026-10-15): a new contact is just Name, Company, Email and Phone, then Save. Title, tags, how
 * we met, keep in touch… wait for Edit, or "More details" opens the whole form here.
 */
export function ContactForm({ contact, pickers, onClose, company }: { contact?: Contact; pickers: Pickers; onClose: () => void; company?: { id: number; name: string } }) {
  const router = useRouter();
  const { run, busy } = useSave();
  const c = contact;
  const [first, setFirst] = useState(c?.first_name ?? ""), [last, setLast] = useState(c?.last_name ?? ""), [title, setTitle] = useState(c?.job_title ?? "");
  const [cos, setCos] = useState<Row[]>(c?.companies.length ? c.companies.map((x) => ({ id: x.id, name: x.name, title: x.title })) : [{ id: company?.id, name: company?.name ?? "", title: "" }]);
  const [emails, setEmails] = useState<Labeled[]>(c?.emails.length ? c.emails : [{ label: "", value: "" }]);
  const [phones, setPhones] = useState<Labeled[]>(c?.phones.length ? c.phones : [{ label: "", value: "" }]);
  const [kinds, setKinds] = useState<string[]>(c?.kinds ?? []);
  const [tags, setTags] = useState(c?.tags.join(", ") ?? "");
  const [more, setMore] = useState(!!c);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  // No duplicates: who's already in Rolodex with this name, email or phone (not this person, when editing).
  const dupes = useDupes(contactQuery({ first, last, emails: emails.map((x) => x.value), phones: phones.map((x) => x.value), not: c?.id }));
  const [askedAnyway, setAskedAnyway] = useState(false);
  const asking = !c && askedAnyway && dupes.found.length > 0;
  const open = (href: string) => { onClose(); router.push(href); };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), v = (k: string) => String(f.get(k) ?? "");
    // A company typed by name is the one already in Rolodex when it's the same name (Inc, LLC and case aside).
    const companies = cos.filter((x) => x.id || x.name.trim()).map((x) => ({ id: x.id ?? companyMatch(pickers.companies, x.name)?.id, name: x.name, title: x.title }));
    // A new person who looks like someone already here: say so first; the next click is "Add anyway".
    if (!c && !asking && (await dupes.now()).length) { setError(""); setAskedAnyway(true); return; }
    const r = await run("contact.save", {
      id: c?.id, first_name: first, last_name: last, job_title: title, companies, kinds,
      emails: emails.filter((x) => x.value.trim()), phones: phones.filter((x) => x.value.trim()),
      website: v("website"), linkedin: v("linkedin"), socials: v("socials"), city: v("city"), state: v("state"), birthday: v("birthday"),
      how_met: v("how_met"), introduced_by: v("introduced_by"), owner_id: v("owner_id"), tags: v("tags").split(","),
      next_follow_up: v("next_follow_up"), keep_in_touch: v("keep_in_touch"), allow_duplicate: asking || undefined,
    }, c ? "Saved" : undefined);
    if (!r.ok) {
      // Someone added the same person a moment ago: show who, with Add anyway.
      if (!c && /already in Rolodex/i.test(r.error ?? "") && (await dupes.now()).length) { setError(""); setAskedAnyway(true); return; }
      setError(r.error ?? ""); return;
    }
    onClose();
    if (!c && r.id) router.push("/contacts/" + r.id);
  };

  const quick = !more;
  const multi = (rows: Labeled[], set: (r: Labeled[]) => void, kind: "email" | "tel", word: string) => quick ? (
    <label className="field"><span>{word}</span>
      <input className="in" type={kind} value={rows[0]?.value ?? ""} placeholder={kind === "email" ? "name@company.com" : "(661) 555-0123"} onChange={(e) => set(rows.map((y, j) => (j === 0 ? { ...y, value: e.target.value } : y)))} />
    </label>
  ) : (
    <div className="field"><span>{word}</span>
      {rows.map((x, i) => (
        <div key={i} className="field-row" style={{ gridTemplateColumns: "minmax(0,1fr) 120px" }}>
          <input className="in" type={kind} value={x.value} aria-label={word} placeholder={kind === "email" ? "name@company.com" : "(661) 555-0123"} onChange={(e) => set(rows.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
          <input className="in" value={x.label} aria-label={word + " label"} placeholder="Work, cell…" onChange={(e) => set(rows.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
        </div>
      ))}
      <button type="button" className="link" style={{ justifySelf: "start", fontSize: 13.5 }} onClick={() => set([...rows, { label: "", value: "" }])}>+ Add another</button>
    </div>
  );

  return (
    <Popup title={c ? "Edit " + (c.name || "contact") : "New contact"} onClose={onClose} wide={more}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="contact-form" className="btn btn-primary" disabled={busy}>{asking ? "Add anyway" : "Save"}</button></>}>
      <form id="contact-form" className="form-grid" onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <DupeNotice found={dupes.found} onOpen={open} asking={asking} what="contact" />
        {/* Quick add takes the whole name in one field ("Michael Anderson"); More details shows it split. */}
        {quick ? (
          <label className="field"><span>Name</span><input className="in" value={typed} autoFocus autoComplete="off"
            onChange={(e) => { const v = e.target.value; setTyped(v); const [f, ...rest] = v.trimStart().split(/\s+/); setFirst(f ?? ""); setLast(rest.join(" ").trim()); }} /></label>
        ) : (
          <div className="field-row">
            <label className="field"><span>First name</span><input className="in" value={first} onChange={(e) => setFirst(e.target.value)} autoFocus autoComplete="off" /></label>
            <label className="field"><span>Last name</span><input className="in" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" /></label>
          </div>
        )}
        {!quick && <label className="field"><span>Job title <em>optional</em></span><input className="in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Owner, Operations Manager…" /></label>}
        <div className="field"><span>Company <em>optional · pick one or type a new name</em></span>
          {cos.map((x, i) => {
            // Say which company this will be: the one already in Rolodex (even typed a bit differently), or a new one.
            const same = x.id ? pickers.companies.find((p) => p.id === x.id) : undefined;
            return (
              <div key={i} className="co-pick">
                <div className="field-row" style={{ gridTemplateColumns: quick ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,.8fr)" }}>
                  <Autocomplete value={x.name} options={pickers.companies.map(company => company.name)} icon="buildings" aria-label="Company" placeholder="ABC Construction"
                    onChange={value => setCos(cos.map((y, j) => (j === i ? { name: value, title: y.title, id: companyMatch(pickers.companies, value)?.id } : y)))} />
                  {!quick && <input className="in" value={x.title} aria-label="Role there" placeholder="Role there (optional)" onChange={(e) => setCos(cos.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} />}
                </div>
                {x.name.trim() && (same ? same.name !== x.name.trim() && <small className="co-hint">Same as <b>{same.name}</b>, already in Rolodex</small>
                  : <small className="co-hint">New company · added to Rolodex when you save</small>)}
              </div>
            );
          })}
          {!quick && <button type="button" className="link" style={{ justifySelf: "start", fontSize: 13.5 }} onClick={() => setCos([...cos, { name: "", title: "" }])}>+ Another company</button>}
        </div>
        <div className="field-row">{multi(emails, setEmails, "email", "Email")}{multi(phones, setPhones, "tel", "Phone")}</div>
        {quick ? <button type="button" className="link" style={{ justifySelf: "start" }} onClick={() => setMore(true)}>More details</button> : <>
          <div className="field"><span>Who they are to us</span>
            <div className="chip-pick">{KINDS.map(([k, label]) => (
              <label key={k}><input type="checkbox" checked={kinds.includes(k)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k] : kinds.filter((x) => x !== k))} /><span>{label}</span></label>))}</div>
          </div>
          <div className="field-row">
            <label className="field"><span>Next follow-up <em>optional</em></span><input className="in" type="date" name="next_follow_up" defaultValue={c?.next_follow_up ?? ""} /></label>
            <label className="field"><span>Keep in touch</span><select className="in" name="keep_in_touch" defaultValue={c?.keep_in_touch ?? ""}><option value="">Not set</option>{CADENCES.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select></label>
          </div>
          <div className="field-row">
            <label className="field"><span>How we met</span><input className="in" name="how_met" defaultValue={c?.how_met ?? ""} placeholder="Chamber mixer, referral…" /></label>
            <label className="field"><span>Introduced by</span><select className="in" name="introduced_by" defaultValue={c?.introduced_by ?? ""}><option value="">Nobody</option>{pickers.contacts.filter((p) => p.id !== c?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Website</span><input className="in" name="website" defaultValue={c?.website ?? ""} placeholder="example.com" /></label>
            <label className="field"><span>LinkedIn</span><input className="in" name="linkedin" defaultValue={c?.linkedin ?? ""} placeholder="linkedin.com/in/…" /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>City</span><input className="in" name="city" defaultValue={c?.city ?? ""} placeholder="Bakersfield" /></label>
            <label className="field"><span>State</span><input className="in" name="state" defaultValue={c?.state ?? ""} placeholder="CA" /></label>
            <label className="field"><span>Birthday <em>optional</em></span><input className="in" type="date" name="birthday" defaultValue={c?.birthday ?? ""} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Tags <em>comma between</em></span><Autocomplete name="tags" value={tags} onChange={setTags} options={pickers.tags} icon="tag" placeholder="Chamber, Construction" /></label>
            <label className="field"><span>Looked after by</span><select className="in" name="owner_id" defaultValue={c?.owner_id ?? ""}><option value="">Nobody yet</option>{pickers.team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          </div>
          <label className="field"><span>Other profiles <em>one link per line</em></span><textarea className="in" name="socials" rows={2} defaultValue={c?.socials ?? ""} /></label>
        </>}
      </form>
    </Popup>
  );
}
