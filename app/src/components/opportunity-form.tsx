"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popup, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { StageMenu } from "./stage-menu";
import { PickOne } from "./activities-parts";
import type { Opportunity } from "@/lib/data";
import { Autocomplete } from "./autocomplete";

type Named = { id: number; name: string };
/** What the form's company and contact pickers offer (pickers() has both). */
export type ProjectNames = { companies: Named[]; contacts: Named[] };
export type ProjectPrefill = { company_id?: number; company?: string; contact_id?: number; stage?: string };

/**
 * New project and Edit (Brendan, 2026-10-15: keep it simple): name, company, main contact, value, stage, expected
 * close and next follow-up. A company typed by a new name is added to the Rolodex.
 */
export function OpportunityForm({ opp, names, prefill, onClose }: { opp?: Opportunity; names: ProjectNames; prefill?: ProjectPrefill; onClose: () => void }) {
  const router = useRouter();
  const { run, busy } = useSave();
  const [company, setCompany] = useState(opp ? opp.company ?? "" : prefill?.company ?? names.companies.find((c) => c.id === prefill?.company_id)?.name ?? "");
  const [error, setError] = useState("");
  const [contact, setContact] = useState(String(opp ? opp.contact_id ?? "" : prefill?.contact_id ?? ""));
  const [stage, setStage] = useState(opp?.stage ?? prefill?.stage ?? "lead");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), v = (k: string) => String(f.get(k) ?? "");
    if (!v("name").trim()) { setError("Name the project."); return; }
    const typed = company.trim(), known = names.companies.find((c) => c.name.toLowerCase() === typed.toLowerCase());
    const r = await run("opportunity.save", {
      id: opp?.id, name: v("name"), company_id: known?.id, company: known ? "" : typed, contact_id: v("contact_id"),
      value: v("value"), stage: v("stage"), close_date: v("close_date"), next_follow_up: v("next_follow_up"),
    }, opp ? "Saved" : undefined);
    if (!r.ok) { setError(r.error ?? ""); return; }
    onClose();
    if (!opp && r.id) router.push("/pipeline/" + r.id);
  };

  return (
    <Popup title={opp ? "Edit " + opp.name : "New project"} onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="opp-form" className="btn btn-primary" disabled={busy}>{opp ? "Save" : "Add project"}</button></>}>
      <form id="opp-form" className="form-grid" onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label className="field"><span>Project name</span><input className="in" name="name" defaultValue={opp?.name} placeholder="Custom scheduling software" autoFocus autoComplete="off" /></label>
        <div className="field-row">
          <label className="field"><span>Company <em>pick one or type a new name</em></span>
            <Autocomplete value={company} onChange={setCompany} options={names.companies.map(company => company.name)} icon="buildings" placeholder="ABC Construction" /></label>
          <div className="field"><span>Main contact <em>optional</em></span><input type="hidden" name="contact_id" value={contact} />
            <PickOne options={names.contacts.map(c => ({ key: String(c.id), name: c.name, icon: "person" }))} value={contact} onChange={setContact} label="Main contact" placeholder="No one yet" /></div>
        </div>
        <div className="field-row">
          <label className="field"><span>Estimated value <em>dollars</em></span><input className="in" name="value" inputMode="decimal" defaultValue={opp?.value_cents ? (opp.value_cents / 100).toLocaleString("en-US") : ""} placeholder="$35,000" autoComplete="off" /></label>
          <div className="field"><span>Stage</span><input type="hidden" name="stage" value={stage} /><StageMenu stage={stage} onChange={setStage} label="Stage" /></div>
        </div>
        <div className="field-row">
          <label className="field"><span>Expected close <em>optional</em></span><input className="in" type="date" name="close_date" defaultValue={opp?.close_date ?? ""} /></label>
          <label className="field"><span>Next follow-up <em>optional</em></span><input className="in" type="date" name="next_follow_up" defaultValue={opp?.next_follow_up ?? ""} /></label>
        </div>
      </form>
    </Popup>
  );
}

export function NewProject({ names, prefill, label = "New project", primary = true, small }: { names: ProjectNames; prefill?: ProjectPrefill; label?: string; primary?: boolean; small?: boolean }) {
  const o = useOpen();
  return <><button type="button" className={"btn" + (primary ? " btn-primary" : "") + (small ? " btn-sm" : "")} onClick={o.show}><Icon name="plus" />{label}</button>{o.open && <OpportunityForm names={names} prefill={prefill} onClose={o.hide} />}</>;
}
