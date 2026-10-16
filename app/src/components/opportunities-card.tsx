"use client";
import Link from "next/link";
import { NewProject, type ProjectNames } from "./opportunity-form";
import { StagePill } from "./opportunity-parts";
import { OPEN_STAGES, dayLabel, money } from "@/lib/format";
import type { Opportunity } from "@/lib/data";

/**
 * "Projects" on a company's or a contact's page: each opens its project page; New project starts one for this company
 * (or this person, and their company when they have one).
 */
export function OpportunitiesCard({ projects, names, company, contact }: { projects: Opportunity[]; names: ProjectNames; company?: { id: number; name: string }; contact?: { id: number; company?: { id: number; name: string } } }) {
  // Open ones first, then won, lost and on hold.
  const list = [...projects].sort((a, b) => Number(!OPEN_STAGES.includes(a.stage)) - Number(!OPEN_STAGES.includes(b.stage)));
  const co = company ?? contact?.company;
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Projects</h3>
        <NewProject names={names} prefill={{ company_id: co?.id, company: co?.name, contact_id: contact?.id }} primary={false} small />
      </div>
      {list.length ? <div className="linked">{list.map((o) => {
        const other = company ? o.contact : o.company;
        return (
          <div key={o.id} className="linked-row tap" data-kind="opportunity" data-id={o.id} data-name={o.name}>
            <Link href={"/pipeline/" + o.id} className="tap-link" aria-label={"Open " + o.name} />
            <span className="grow"><strong>{o.name}</strong><small>{[other, o.value_cents ? money(o.value_cents) : "", o.close_date && OPEN_STAGES.includes(o.stage) ? "Closes " + dayLabel(o.close_date) : ""].filter(Boolean).join(" · ") || "No value yet"}</small></span>
            <StagePill stage={o.stage} />
          </div>
        );
      })}</div> : <p className="muted" style={{ margin: 0 }}>No projects yet.</p>}
    </div>
  );
}
