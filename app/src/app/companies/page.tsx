import { Directory } from "@/components/directory";
import { FilterSummary } from "@/components/list-tools";
import { Suspense } from "react";
import { companyDirectory, allIndustries, allTags, services, team, type CompanySort } from "@/lib/data";
import { NewCompany } from "@/components/company-form";
import { SelectButton } from "@/components/record-menu";
import { FilterSearch, FilterSelect } from "@/components/list-tools";
import { reopenWithLastPicks } from "@/lib/remembered";

export const metadata = { title: "Companies · Rolodex" };

export default async function Companies({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // Opened plain: back to the last sort and filters picked here.
  await reopenWithLastPicks("/companies", sp, ["industry", "tag", "sort"]);
  const sort = (["name", "recent", "follow_up"].includes(sp.sort ?? "") ? sp.sort : "name") as CompanySort;
  const [directory, industries, tags, needs, people] = await Promise.all([companyDirectory({ q: sp.q, tag: sp.tag, industry: sp.industry, sort }, 1), allIndustries(), allTags(), services(), team()]);
  const list = directory.items;
  const filtered = !!(sp.q || sp.tag || sp.industry);
  return (
    <>
      <div className="page-head"><div><h1>Companies</h1></div>
        <div className="page-acts"><SelectButton kind="company" /><NewCompany options={{ industries, services: needs, team: people, tags }} /></div></div>
      <div className="toolbar">
        <Suspense>
          <FilterSearch placeholder="Search name, industry, city, website" />
          {industries.length > 0 && <FilterSelect name="industry" label="Industry" options={[["", "All industries"], ...industries.map((i): [string, string] => [i, i])]} />}
          {tags.length > 0 && <FilterSelect name="tag" label="Tag" options={[["", "All tags"], ...tags.map((t): [string, string] => [t, t])]} />}
          <span className="grow" />
          <span className="count">{directory.total} {directory.total === 1 ? "company" : "companies"}</span>
          <FilterSelect name="sort" label="Sort" options={[["", "Name A–Z"], ["recent", "Newest first"], ["follow_up", "Next follow-up"]]} />
        </Suspense>
      </div>
      <Suspense><FilterSummary /></Suspense>
      {!list.length ? (
        <div className="card empty">{filtered ? <><strong>No company matches.</strong>Try another search, or clear the filters above.</> : <><strong>No companies yet.</strong>Add the first business you know.</>}</div>
      ) : (
        <Directory key={JSON.stringify([sp.q ?? "", sp.tag ?? "", sp.industry ?? "", sort])} kind="companies" initial={directory} params={sp} />
      )}
    </>
  );
}
