"use client";
import { useState } from "react";
import { Popup, useDelete, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { LEAD_STAGES, PRIORITIES, TZ, dayLabel, stageLabel } from "@/lib/format";
import type { Lead } from "@/lib/data";

// A company's or a person's lead, for the side column of their page. A lead isn't its own record: the name, industry,
// city and follow-up stay on the company or person, so this card holds only the sales facts.

type Named = { id: number; name: string };
export type LeadDraft = { stage: string; priority: string; source: string; interested: string[]; owner_id: string };
export const NEW_LEAD: LeadDraft = { stage: "new", priority: "medium", source: "", interested: [], owner_id: "" };

/** Pill colors: blue once they're ready to contact, green once they've answered; high priority stands out. */
export const stageTone = (s: string) => (["ready", "contacted"].includes(s) ? " is-accent" : ["responded", "meeting", "qualified"].includes(s) ? " is-ok" : "");
export const priorityTone = (p: string) => (p === "high" ? " is-warn" : "");

/** Stage, owner, priority, source and services: the same fields for marking one and for editing it. */
export function LeadFields({ v, set, services, team }: { v: LeadDraft; set: (v: LeadDraft) => void; services: string[]; team: Named[] }) {
  // A service they were marked with before the list changed still shows, so saving doesn't drop it.
  const options = [...services, ...v.interested.filter((s) => !services.includes(s))];
  const toggle = (s: string) => set({ ...v, interested: v.interested.includes(s) ? v.interested.filter((x) => x !== s) : [...v.interested, s] });
  return (
    <>
      <div className="field-row">
        <label className="field"><span>Stage</span>
          <select className="in" value={v.stage} onChange={(e) => set({ ...v, stage: e.target.value })}>
            {LEAD_STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
        <label className="field"><span>Owner <em>optional</em></span>
          <select className="in" value={v.owner_id} onChange={(e) => set({ ...v, owner_id: e.target.value })}>
            <option value="">No one</option>{team.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
      </div>
      <div className="field" role="radiogroup" aria-label="Priority"><span>Priority</span>
        <div className="chip-pick">{PRIORITIES.map(([k, l]) => <label key={k}><input type="radio" name="lead-priority" checked={v.priority === k} onChange={() => set({ ...v, priority: k })} /><span>{l}</span></label>)}</div>
      </div>
      <label className="field"><span>Source <em>optional</em></span><input className="in" value={v.source} onChange={(e) => set({ ...v, source: e.target.value })} placeholder="Kern 1000, a referral, the website…" /></label>
      {options.length > 0 && (
        <div className="field" role="group" aria-label="Interested in"><span>Interested in <em>optional</em></span>
          <div className="chip-pick">{options.map((s) => <label key={s}><input type="checkbox" checked={v.interested.includes(s)} onChange={() => toggle(s)} /><span>{s}</span></label>)}</div>
        </div>
      )}
    </>
  );
}

/** Mark as lead, and Edit. Marking one that's already a lead just updates it (the server keeps one per record). */
export function LeadForm({ lead, about, services, team, onClose }: { lead?: Lead | null; about: { company_id?: number; contact_id?: number }; services: string[]; team: Named[]; onClose: () => void }) {
  const { run, busy } = useSave();
  const [v, setV] = useState<LeadDraft>(lead ? { stage: lead.stage, priority: lead.priority, source: lead.source, interested: lead.interested ?? [], owner_id: String(lead.owner_id ?? "") } : NEW_LEAD);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((await run("lead.save", { id: lead?.id, ...about, ...v }, lead ? "Saved" : "Marked as a lead")).ok) onClose();
  };
  return (
    <Popup title={lead ? "Edit lead" : "Mark as lead"} onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="lead-form" className="btn btn-primary" disabled={busy}>{lead ? "Save" : "Mark as lead"}</button></>}>
      <form id="lead-form" className="form-grid" onSubmit={submit}><LeadFields v={v} set={setV} services={services} team={team} /></form>
    </Popup>
  );
}

/** The Lead card. Not a lead yet: one button. A lead: its stage changes right here; the rest is under Edit. */
export function LeadCard({ lead, companyId, contactId, services, team }: { lead: Lead | null; companyId?: number; contactId?: number; services: string[]; team: Named[] }) {
  const form = useOpen();
  const { run, busy } = useSave();
  const del = useDelete();
  const popup = form.open && <LeadForm lead={lead} about={companyId ? { company_id: companyId } : { contact_id: contactId }} services={services} team={team} onClose={form.hide} />;

  if (!lead) return (
    <div className="card card-pad linked">
      <div className="linked-row">
        <span className="avatar"><Icon name="leads" /></span>
        <span className="grow"><strong>Not a lead</strong><small>Pursuing them? Track it on Leads.</small></span>
        <button type="button" className="btn btn-sm" onClick={form.show}>Mark as lead</button>
      </div>
      {popup}
    </div>
  );

  const move = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stage = e.target.value;
    if (!(await run("lead.stage", { id: lead.id, stage }, "Moved to " + stageLabel(LEAD_STAGES, stage))).ok) e.target.value = lead.stage;
  };
  // created_at is a moment; "since" is the day it was in Bakersfield.
  const since = new Date(lead.created_at).toLocaleDateString("en-CA", { timeZone: TZ });
  return (
    <div className="card card-pad">
      <h3>Lead</h3>
      <dl className="facts">
        <div><dt>Stage</dt><dd>
          {/* Keyed on the stage so it shows the saved one again after the page refreshes. */}
          <select key={lead.stage} className="in" aria-label="Stage" defaultValue={lead.stage} disabled={busy} onChange={move}>
            {LEAD_STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></dd></div>
        <div><dt>Priority</dt><dd><span className={"pill" + priorityTone(lead.priority)}>{stageLabel(PRIORITIES, lead.priority)}</span></dd></div>
        <div><dt>Source</dt><dd>{lead.source || <span className="muted">Not set</span>}</dd></div>
        <div><dt>Interested in</dt><dd>{lead.interested?.length ? <span className="tags">{lead.interested.map((s) => <span key={s} className="tag">{s}</span>)}</span> : <span className="muted">Not set</span>}</dd></div>
        <div><dt>Owner</dt><dd>{lead.owner ?? <span className="muted">No one</span>}</dd></div>
        <div><dt>Lead since</dt><dd>{dayLabel(since)}</dd></div>
      </dl>
      <div className="composer-row" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-sm" onClick={form.show}><Icon name="edit" />Edit</button>
        <span className="grow" />
        <button type="button" className="btn btn-sm btn-danger" onClick={() => del("lead", lead.id)}>Not a lead anymore</button>
      </div>
      {popup}
    </div>
  );
}
