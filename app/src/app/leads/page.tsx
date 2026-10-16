import { FilterSummary } from "@/components/list-tools";
import { Suspense } from "react";
import { allIndustries, companyTags, contactNames, leadCities, leadCounts, leadSources, listLeads, services, team, type LeadSort } from "@/lib/data";
import { LEAD_STAGES, PRIORITIES, stageLabel } from "@/lib/format";
import { FilterSearch, FilterSelect, MoreFilters } from "@/components/list-tools";
import { AddLeads, LeadRows, StageTabs } from "@/components/leads-parts";
import "./leads.css";

export const metadata = { title: "Leads · Rolodex" };

// Docs section 4. A lead is a company or a person marked as one, so the name, industry, city and follow-up here come
// straight from that record.
export default async function Leads({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sort = (["priority", "recent", "name", "follow_up"].includes(sp.sort ?? "") ? sp.sort : "priority") as LeadSort;
  const stage = LEAD_STAGES.some(([k]) => k === sp.stage) ? sp.stage! : "open";
  const [list, counts, sources, cities, industries, every, companies, contacts, needs, people] = await Promise.all([
    listLeads({ stage, q: sp.q, priority: sp.priority, industry: sp.industry, city: sp.city, source: sp.source, sort }),
    leadCounts(), leadSources(), leadCities(), allIndustries(),
    // For Add leads: who's already a lead, and every company and person to pick from (lean: id, name, industry, tags).
    listLeads(), companyTags(), contactNames(), services(), team(),
  ]);
  const filtered = !!(sp.q || sp.priority || sp.industry || sp.city || sp.source);
  return (
    <>
      <div className="page-head"><div><h1>Leads</h1></div>
        <div className="page-acts">
          <AddLeads companies={companies} contacts={contacts}
            leadCompanies={every.flatMap((l) => (l.company_id ? [l.company_id] : []))} leadContacts={every.flatMap((l) => (l.contact_id ? [l.contact_id] : []))}
            services={needs} team={people} />
        </div></div>
      <Suspense><StageTabs counts={counts} /></Suspense>
      <div className="toolbar">
        <Suspense>
          <FilterSearch placeholder="Search name or industry" />
          <MoreFilters keys={["industry","city","priority","source"]}>
          {industries.length > 0 && <FilterSelect name="industry" label="Industry" options={[["", "All industries"], ...industries.map((i): [string, string] => [i, i])]} />}
          {cities.length > 0 && <FilterSelect name="city" label="City" options={[["", "All cities"], ...cities.map((c): [string, string] => [c, c])]} />}
          <FilterSelect name="priority" label="Priority" options={[["", "Any priority"], ...PRIORITIES]} />
          {sources.length > 0 && <FilterSelect name="source" label="Source" options={[["", "All sources"], ...sources.map((s): [string, string] => [s, s])]} />}
          </MoreFilters>
          <span className="grow" />
          <span className="count">{list.length} {list.length === 1 ? "lead" : "leads"}</span>
          <FilterSelect name="sort" label="Sort" options={[["", "Priority"], ["recent", "Newest first"], ["name", "Name A–Z"], ["follow_up", "Next follow-up"]]} />
        </Suspense>
      </div>
      <Suspense><FilterSummary /></Suspense>
      {!list.length ? (
        <div className="card empty">{filtered ? <><strong>No lead matches.</strong>Try another search, or clear the filters above.</>
          : stage !== "open" ? <><strong>No one is in {stageLabel(LEAD_STAGES, stage)}.</strong>Move leads here from the list or their page.</>
          : <><strong>No leads yet.</strong>Add a prospect list like the Kern 1000, or mark one company or person.</>}</div>
      ) : (
        // A new list (another stage or filter) starts with nothing picked.
        <LeadRows key={JSON.stringify(sp)} leads={list} />
      )}
    </>
  );
}
