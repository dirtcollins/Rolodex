import { FilterSummary } from "@/components/list-tools";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { companyNames, contactNames, listOpportunities, pipelineSummary } from "@/lib/data";
import { OPP_STAGES, PIPELINE_OPEN_COOKIE, PIPELINE_SORTS, PIPELINE_SORT_COOKIE, PIPELINE_STAGE_COOKIE, PIPELINE_VIEW_COOKIE, money } from "@/lib/format";
import { FilterSearch } from "@/components/list-tools";
import { NewProject } from "@/components/opportunity-form";
import { SelectButton } from "@/components/record-menu";
import { PipelineBoard, PipelineSort, ViewToggle } from "@/components/pipeline-board";
import "./pipeline.css";

export const metadata = { title: "Pipeline · Rolodex" };

const projects = (n: number) => n + (n === 1 ? " project" : " projects");

// The Pipeline (Docs: 5. Pipeline): every project (an opportunity) by stage, as a board or a list, with the totals on top.
export default async function Pipeline({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams, jar = await cookies();
  const saved = {
    view: jar.get(PIPELINE_VIEW_COOKIE)?.value === "list" ? "list" as const : "board" as const,
    sort: PIPELINE_SORTS.find(([v]) => v === jar.get(PIPELINE_SORT_COOKIE)?.value)?.[0] ?? "stage",
    open: decodeURIComponent(jar.get(PIPELINE_OPEN_COOKIE)?.value ?? "").split(",").filter(Boolean),
    stage: OPP_STAGES.find(([v]) => v === jar.get(PIPELINE_STAGE_COOKIE)?.value)?.[0] ?? "",
  };
  const [list, sum, companies, contacts] = await Promise.all([listOpportunities({ q: sp.q }), pipelineSummary(), companyNames(), contactNames()]);
  return (
    <>
      <div className="page-head"><div><h1>Pipeline</h1></div>
        <div className="page-acts"><Suspense><ViewToggle saved={saved.view} /></Suspense><SelectButton kind="opportunity" /><NewProject names={{ companies, contacts }} /></div></div>
      <div className="pipe-stats card" aria-label="Totals">
        <div><span>Open pipeline</span><b>{money(sum.open_value)}</b><small>{projects(sum.open_count)}</small></div>
        <div><span>Won this month</span><b className={sum.won_count ? "is-ok" : ""}>{money(sum.won_value)}</b><small>{sum.won_count ? projects(sum.won_count) : "Nothing yet"}</small></div>
        <div><span>Won this year</span><b className={sum.won_year_count ? "is-ok" : ""}>{money(sum.won_year_value)}</b><small>{sum.won_year_count ? projects(sum.won_year_count) : "Nothing yet"}</small></div>
        <div><span>Proposals waiting</span><b>{sum.proposals}</b><small>{sum.proposals ? "Sent, no answer yet" : "None out"}</small></div>
      </div>
      <div className="toolbar">
        <Suspense><FilterSearch placeholder="Search project, company or person" /></Suspense>
        <span className="grow" />
        <span className="count">{projects(list.length)}</span>
        <Suspense><PipelineSort saved={saved} /></Suspense>
      </div>
      <Suspense><FilterSummary /></Suspense>
      {!list.length ? (
        <div className="card empty">{sp.q ? <><strong>No project matches.</strong>Try another search.</> : <><strong>No projects yet.</strong>Add the first one with New project.</>}</div>
      ) : <Suspense><PipelineBoard opps={list} saved={saved} /></Suspense>}
    </>
  );
}
