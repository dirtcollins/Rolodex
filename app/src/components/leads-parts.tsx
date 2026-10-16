"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Popup, toast, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { useParam } from "./list-tools";
import { LeadFields, NEW_LEAD, priorityTone, stageTone, type LeadDraft } from "./lead-card";
import { CompanyAvatar } from "./company-avatar";
import { LEAD_STAGES, PRIORITIES, dayLabel, dueState, initials, stageLabel } from "@/lib/format";
import type { Lead } from "@/lib/data";

// The client pieces of the Leads page: the stage tabs, the list with its select-several bar, and Add leads.

type Named = { id: number; name: string };
export type LeadCompany = { id: number; name: string; industry: string; tags: string[] };

/** All open, then each stage with how many are in it. The pick lives in the address like the other filters. */
export function StageTabs({ counts }: { counts: Record<string, number> }) {
  const sp = useSearchParams(), set = useParam();
  const now = sp.get("stage") ?? "";
  const open = LEAD_STAGES.reduce((n, [k]) => n + (k === "not_interested" ? 0 : counts[k] ?? 0), 0);
  const tabs: [string, string, number][] = [["", "All open", open], ...LEAD_STAGES.map(([k, l]): [string, string, number] => [k, l, counts[k] ?? 0])];
  return (
    <div className="chip-pick lead-tabs" role="radiogroup" aria-label="Stage">
      {tabs.map(([k, l, n]) => <label key={k}><input type="radio" name="stage" checked={now === k} onChange={() => set("stage", k)} /><span>{l}<small>{n}</small></span></label>)}
    </div>
  );
}

/** The list. Each row opens its company or person; the checkbox only picks it, for moving several at once. */
export function LeadRows({ leads }: { leads: Lead[] }) {
  const { run, busy } = useSave();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const picked = leads.filter((l) => sel.has(l.id));
  const all = picked.length === leads.length;
  const flip = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const move = async (stage: string) => {
    if (!stage || !picked.length) return;
    if (!(await run("lead.stage", { ids: picked.map((l) => l.id), stage })).ok) return;
    setSel(new Set());
    // Undo puts each one back in the stage it came from.
    const back = new Map<string, number[]>();
    for (const l of picked) if (l.stage !== stage) back.set(l.stage, [...(back.get(l.stage) ?? []), l.id]);
    toast(`Moved ${picked.length} to ${stageLabel(LEAD_STAGES, stage)}`, false, back.size ? async () => {
      for (const [s, ids] of back) if (!(await run("lead.stage", { ids, stage: s })).ok) return;
      toast("Moved back");
    } : undefined);
  };

  return (
    <>
      {picked.length > 0 && (
        <div className="lead-bulk card" role="region" aria-label="Selected leads">
          <strong>{picked.length} selected</strong>
          <label className="lead-move"><span>Move to</span>
            <select className="in" value="" disabled={busy} onChange={(e) => move(e.target.value)}>
              <option value="">Pick a stage…</option>{LEAD_STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          {!all && <button type="button" className="btn btn-sm btn-quiet" onClick={() => setSel(new Set(leads.map((l) => l.id)))}>Select all {leads.length}</button>}
          <button type="button" className="btn btn-sm" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}
      <div className="rows">
        <div className="lead-row row-head">
          <label className="lead-check"><input type="checkbox" aria-label="Select all" checked={all && leads.length > 0}
            ref={(el) => { if (el) el.indeterminate = picked.length > 0 && !all; }} onChange={() => setSel(all ? new Set() : new Set(leads.map((l) => l.id)))} /></label>
          <span>Name</span><span>Stage</span><span className="lead-pri">Priority</span><span className="lead-source">Source</span><span className="lead-follow">Next follow-up</span>
        </div>
        {leads.map((l) => {
          const due = dueState(l.next_follow_up);
          return (
            <div key={l.id} className={"lead-row tap" + (sel.has(l.id) ? " is-picked" : "")}>
              <Link href={l.company_id ? "/companies/" + l.company_id : "/contacts/" + l.contact_id} className="tap-link" aria-label={"Open " + l.name} />
              <label className="lead-check"><input type="checkbox" aria-label={"Select " + l.name} checked={sel.has(l.id)} onChange={() => flip(l.id)} /></label>
              <span className="who">{l.company_id ? <CompanyAvatar id={l.company_id} name={l.name} /> : <span className="avatar">{initials(l.name)}</span>}
                <span style={{ minWidth: 0 }}><strong>{l.name}</strong><small>{l.sub || (l.company_id ? "No industry yet" : "No title yet")}</small></span></span>
              <span className="cell"><span className={"pill" + stageTone(l.stage)}>{stageLabel(LEAD_STAGES, l.stage)}</span></span>
              <span className="cell lead-pri"><span className={"pill" + priorityTone(l.priority)}>{stageLabel(PRIORITIES, l.priority)}</span></span>
              <span className="cell lead-source">{l.source || <span className="muted">—</span>}</span>
              <span className={"cell lead-follow" + (due ? " is-" + due : "")}>{dayLabel(l.next_follow_up) || <span className="muted">—</span>}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

type AddProps = { companies: LeadCompany[]; contacts: Named[]; leadCompanies: number[]; leadContacts: number[]; services: string[]; team: Named[] };

/** The Add leads button and its popup. */
export function AddLeads(p: AddProps) {
  const pop = useOpen();
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={pop.show}><Icon name="plus" />Add leads</button>
      {pop.open && <AddLeadsPopup {...p} onClose={pop.hide} />}
    </>
  );
}

type Pick = { kind: "company" | "contact"; id: number; name: string; sub: string; lead: boolean };

/**
 * Two ways in: a whole prospect list at once (every company with a tag and/or in an industry, e.g. the Kern 1000), or
 * one company or person. Ones that are already leads are left as they are.
 */
function AddLeadsPopup({ companies, contacts, leadCompanies, leadContacts, services, team, onClose }: AddProps & { onClose: () => void }) {
  const { run, busy } = useSave();
  const [way, setWay] = useState<"list" | "one">("list");
  const isLead = useMemo(() => ({ company: new Set(leadCompanies), contact: new Set(leadContacts) }), [leadCompanies, leadContacts]);

  // A prospect list. The source follows the tag until it's typed over.
  const tags = useMemo(() => [...new Set(companies.flatMap((c) => c.tags))].sort((a, b) => a.localeCompare(b)), [companies]);
  const industries = useMemo(() => [...new Set(companies.map((c) => c.industry).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [companies]);
  const [tag, setTag] = useState(""), [industry, setIndustry] = useState(""), [source, setSource] = useState("");
  const match = tag || industry ? companies.filter((c) => (!tag || c.tags.includes(tag)) && (!industry || c.industry === industry)) : [];
  const fresh = match.filter((c) => !isLead.company.has(c.id));
  const pickTag = (t: string) => { setSource((s) => (!s || s === tag ? t : s)); setTag(t); };
  const addList = async () => {
    const r = await run("lead.add_companies", { company_ids: fresh.map((c) => c.id), source });
    if (!r.ok) return;
    const n = r.ids?.length ?? 0;
    toast(n === 1 ? "Added 1 lead" : `Added ${n} leads`);
    onClose();
  };

  // One company or person.
  const [q, setQ] = useState(""), [pick, setPick] = useState<Pick | null>(null), [v, setV] = useState<LeadDraft>(NEW_LEAD);
  const everyone = useMemo<Pick[]>(() => [
    ...companies.map((c): Pick => ({ kind: "company", id: c.id, name: c.name, sub: c.industry || "Company", lead: isLead.company.has(c.id) })),
    ...contacts.map((c): Pick => ({ kind: "contact", id: c.id, name: c.name, sub: "Person", lead: isLead.contact.has(c.id) })),
  ], [companies, contacts, isLead]);
  const words = q.trim().toLowerCase();
  // Names that start with what's typed come first.
  const hits = words ? everyone.filter((x) => x.name.toLowerCase().includes(words)).sort((a, b) => +!a.name.toLowerCase().startsWith(words) - +!b.name.toLowerCase().startsWith(words)).slice(0, 8) : [];
  const addOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pick) return;
    if ((await run("lead.save", { [pick.kind + "_id"]: pick.id, ...v }, pick.name + " is a lead")).ok) onClose();
  };

  return (
    <Popup title="Add leads" onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button>
        {way === "list"
          ? <button type="button" className="btn btn-primary" disabled={busy || !fresh.length} onClick={addList}>{fresh.length === 1 ? "Add 1 as a lead" : `Add ${fresh.length} as leads`}</button>
          : <button type="submit" form="lead-one" className="btn btn-primary" disabled={busy || !pick}>Mark as lead</button>}</>}>
      <div className="form-grid">
        <div className="chip-pick" role="radiogroup" aria-label="How">
          <label><input type="radio" name="add-way" checked={way === "list"} onChange={() => setWay("list")} /><span>From a tag or list</span></label>
          <label><input type="radio" name="add-way" checked={way === "one"} onChange={() => setWay("one")} /><span>One company or person</span></label>
        </div>

        {way === "list" ? <>
          <div className="field-row">
            <label className="field"><span>Companies tagged</span>
              <select className="in" value={tag} onChange={(e) => pickTag(e.target.value)}>
                <option value="">Any tag</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></label>
            <label className="field"><span>In the industry</span>
              <select className="in" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">Any industry</option>{industries.map((i) => <option key={i} value={i}>{i}</option>)}
              </select></label>
          </div>
          <p className="muted" style={{ margin: 0 }} aria-live="polite">
            {!tag && !industry ? "Pick a tag or an industry."
              : !match.length ? "No company matches."
              : `${match.length} ${match.length === 1 ? "company matches" : "companies match"}` + (match.length > fresh.length ? ` · ${match.length - fresh.length} already ${match.length - fresh.length === 1 ? "a lead" : "leads"}` : "")}
          </p>
          <label className="field"><span>Source <em>where they came from</em></span><input className="in" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Kern 1000" /></label>
        </> : (
          <form id="lead-one" className="form-grid" onSubmit={addOne}>
            {pick ? (
              <div className="linked"><div className="linked-row">
                {pick.kind === "company" ? <CompanyAvatar id={pick.id} name={pick.name} /> : <span className="avatar">{initials(pick.name)}</span>}
                <span className="grow"><strong>{pick.name}</strong><small>{pick.sub}</small></span>
                <button type="button" className="btn btn-sm btn-quiet" onClick={() => setPick(null)}>Change</button>
              </div></div>
            ) : (
              <div className="field"><span>Company or person</span>
                <input className="in" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Company or person" autoFocus />
                {words && (
                  <div className="lead-hits">
                    {!hits.length && <p className="search-empty">No one by that name. Add them on Companies or Contacts first.</p>}
                    {hits.map((x) => {
                      const inner = <>{x.kind === "company" ? <CompanyAvatar id={x.id} name={x.name} /> : <span className="avatar">{initials(x.name)}</span>}
                        <span className="search-copy"><strong>{x.name}</strong><small>{x.lead ? "Already a lead · Open" : x.sub}</small></span></>;
                      // Already a lead: open their page, where the Lead card changes it.
                      return x.lead
                        ? <Link key={x.kind + x.id} className="search-item" href={(x.kind === "company" ? "/companies/" : "/contacts/") + x.id}>{inner}</Link>
                        : <button key={x.kind + x.id} type="button" className="search-item" onClick={() => { setPick(x); setQ(""); }}>{inner}</button>;
                    })}
                  </div>
                )}
              </div>
            )}
            {pick && <LeadFields v={v} set={setV} services={services} team={team} />}
          </form>
        )}
      </div>
    </Popup>
  );
}
