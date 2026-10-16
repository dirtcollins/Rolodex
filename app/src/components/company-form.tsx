"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popup, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { DupeNotice, companyQuery, useDupes } from "./dupes";
import type { Company } from "@/lib/data";
import { Autocomplete } from "./autocomplete";

/** What the company form offers to pick from. */
export type CompanyOptions = { industries: string[]; services: string[]; team: { id: number; name: string }[]; tags: string[] };

const SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];

/** The New company button on the Companies list. */
export function NewCompany({ options }: { options: CompanyOptions }) {
  const o = useOpen();
  return <><button type="button" className="btn btn-primary" onClick={o.show}><Icon name="plus" />New company</button>{o.open && <CompanyForm options={options} onClose={o.hide} />}</>;
}

/**
 * New company and Edit. Quick add (Brendan, 2026-10-15): a new company is just Name, Website, Phone and City, then
 * Save; everything else waits for Edit, or "More details" opens the whole form here (open when editing).
 */
export function CompanyForm({ company, options, onClose }: { company?: Company; options: CompanyOptions; onClose: () => void }) {
  const router = useRouter();
  const { run, busy } = useSave();
  const co = company;
  const [needs, setNeeds] = useState<string[]>(co?.needs ?? []);
  const [more, setMore] = useState(!!co);
  const [error, setError] = useState("");
  // No duplicates: a company already in Rolodex with this name (Inc, LLC and case aside) or website.
  const [name, setName] = useState(co?.name ?? ""), [website, setWebsite] = useState(co?.website ?? "");
  const [industry, setIndustry] = useState(co?.industry ?? ""), [tags, setTags] = useState(co?.tags.join(", ") ?? "");
  const dupes = useDupes(companyQuery({ name, website, not: co?.id }));
  const [askedAnyway, setAskedAnyway] = useState(false);
  const asking = !co && askedAnyway && dupes.found.length > 0;
  const open = (href: string) => { onClose(); router.push(href); };
  // A need saved earlier stays pickable even after it leaves the services list in Settings.
  const offered = [...options.services, ...needs.filter((n) => !options.services.includes(n))];

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), v = (k: string) => String(f.get(k) ?? "");
    // A new company that looks like one already here: say so first; the next click is "Add anyway".
    if (!co && !asking && (await dupes.now()).length) { setError(""); setAskedAnyway(true); return; }
    const r = await run("company.save", {
      id: co?.id, name, industry: v("industry"), website, phone: v("phone"), city: v("city"), state: v("state"),
      email: v("email"), street: v("street"), zip: v("zip"), description: v("description"), linkedin: v("linkedin"), socials: v("socials"),
      size: v("size"), revenue: v("revenue"), tech: v("tech"), needs, tags: v("tags").split(","), owner_id: v("owner_id"), next_follow_up: v("next_follow_up"),
      allow_duplicate: asking || undefined,
    }, co ? "Saved" : undefined);
    if (!r.ok) {
      // Someone added the same company a moment ago: show which, with Add anyway.
      if (!co && /already in Rolodex/i.test(r.error ?? "") && (await dupes.now()).length) { setError(""); setAskedAnyway(true); return; }
      setError(r.error ?? ""); return;
    }
    onClose();
    if (!co && r.id) router.push("/companies/" + r.id);
  };

  return (
    <Popup title={co ? "Edit " + co.name : "New company"} onClose={onClose} wide={more}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="company-form" className="btn btn-primary" disabled={busy}>{asking ? "Add anyway" : "Save"}</button></>}>
      <form id="company-form" className="form-grid" onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label className="field"><span>Name</span><input className="in" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ABC Construction" required autoFocus autoComplete="off" /></label>
        <DupeNotice found={dupes.found} onOpen={open} asking={asking} what="company" />
        <div className="field-row">
          {more && <label className="field"><span>Industry <em>optional</em></span><Autocomplete name="industry" value={industry} onChange={setIndustry} options={options.industries} icon="companies" placeholder="Construction, Dental…" /></label>}
          <label className="field"><span>Website <em>optional</em></span><input className="in" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" /></label>
        </div>
        <div className="field-row">
          <label className="field"><span>Phone <em>optional</em></span><input className="in" name="phone" type="tel" defaultValue={co?.phone ?? ""} placeholder="(661) 555-0123" /></label>
          <label className="field"><span>City <em>optional</em></span><input className="in" name="city" defaultValue={co?.city ?? ""} placeholder="Bakersfield" /></label>
          {more && <label className="field"><span>State</span><input className="in" name="state" defaultValue={co?.state ?? ""} placeholder="CA" /></label>}
        </div>
        {!more ? <button type="button" className="link" style={{ justifySelf: "start" }} onClick={() => setMore(true)}>More details</button> : <>
          <div className="field-row">
            <label className="field"><span>Email</span><input className="in" name="email" type="email" defaultValue={co?.email ?? ""} placeholder="office@company.com" /></label>
            <label className="field"><span>Street</span><input className="in" name="street" defaultValue={co?.street ?? ""} placeholder="1200 Truxtun Ave" /></label>
            <label className="field"><span>ZIP</span><input className="in" name="zip" defaultValue={co?.zip ?? ""} placeholder="93301" /></label>
          </div>
          <label className="field"><span>What they do</span><textarea className="in" name="description" rows={3} defaultValue={co?.description ?? ""} placeholder="Family-owned general contractor, mostly commercial work." /></label>
          <div className="field-row">
            <label className="field"><span>LinkedIn</span><input className="in" name="linkedin" defaultValue={co?.linkedin ?? ""} placeholder="linkedin.com/company/…" /></label>
            <label className="field"><span>Size</span><select className="in" name="size" defaultValue={co?.size ?? ""}><option value="">Not known</option>{SIZES.map((s) => <option key={s} value={s}>{s} people</option>)}</select></label>
            <label className="field"><span>Yearly revenue <em>a guess is fine</em></span><input className="in" name="revenue" defaultValue={co?.revenue ?? ""} placeholder="$2M" /></label>
          </div>
          <label className="field"><span>Other profiles <em>one link per line</em></span><textarea className="in" name="socials" rows={2} defaultValue={co?.socials ?? ""} /></label>
          <label className="field"><span>What they use now <em>software, tools, spreadsheets</em></span><textarea className="in" name="tech" rows={2} defaultValue={co?.tech ?? ""} placeholder="QuickBooks, schedules on a spreadsheet, Wix website" /></label>
          {offered.length > 0 && <div className="field"><span>May need</span>
            <div className="chip-pick">{offered.map((n) => (
              <label key={n}><input type="checkbox" checked={needs.includes(n)} onChange={(e) => setNeeds(e.target.checked ? [...needs, n] : needs.filter((x) => x !== n))} /><span>{n}</span></label>))}</div>
          </div>}
          <div className="field-row">
            <label className="field"><span>Tags <em>comma between</em></span><Autocomplete name="tags" value={tags} onChange={setTags} options={options.tags} icon="tag" placeholder="Chamber, Construction" /></label>
            <label className="field"><span>Looked after by</span><select className="in" name="owner_id" defaultValue={co?.owner_id ?? ""}><option value="">Nobody yet</option>{options.team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
            <label className="field"><span>Next follow-up</span><input className="in" type="date" name="next_follow_up" defaultValue={co?.next_follow_up ?? ""} /></label>
          </div>
        </>}
      </form>
    </Popup>
  );
}
