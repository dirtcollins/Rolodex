import { Directory } from "@/components/directory";
import { FilterSummary } from "@/components/list-tools";
import Link from "next/link";
import { Suspense } from "react";
import { contactDirectory, allTags, type ContactSort } from "@/lib/data";
import { pickers } from "@/lib/pickers";
import { KINDS } from "@/lib/format";
import { NewContact } from "@/components/new-contact";
import { SelectButton } from "@/components/record-menu";
import { FilterSearch, FilterSelect } from "@/components/list-tools";
import { reopenWithLastPicks } from "@/lib/remembered";

export const metadata = { title: "Contacts · Rolodex" };

export default async function Contacts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // Opened plain: back to the last sort and filters picked here.
  await reopenWithLastPicks("/contacts", sp, ["kind", "tag", "sort"]);
  const sort = (["name", "recent", "follow_up", "last_contacted"].includes(sp.sort ?? "") ? sp.sort : "name") as ContactSort;
  const [directory, tags, pick] = await Promise.all([contactDirectory({ q: sp.q, tag: sp.tag, kind: sp.kind, sort }, 1), allTags(), pickers()]);
  const list = directory.items;
  const filtered = !!(sp.q || sp.tag || sp.kind);
  return (
    <>
      <div className="page-head"><div><h1>Contacts</h1></div>
        <div className="page-acts"><SelectButton kind="contact" /><Link className="btn" href="/import">Import CSV</Link><NewContact pickers={pick} /></div></div>
      <div className="toolbar">
        <Suspense>
          <FilterSearch placeholder="Search name, company, email, city" />
          <FilterSelect name="kind" label="Who they are" options={[["", "Everyone"], ...KINDS]} />
          {tags.length > 0 && <FilterSelect name="tag" label="Tag" options={[["", "All tags"], ...tags.map((t): [string, string] => [t, t])]} />}
          <span className="grow" />
          <span className="count">{directory.total} {directory.total === 1 ? "contact" : "contacts"}</span>
          <FilterSelect name="sort" label="Sort" options={[["", "Name A–Z"], ["recent", "Newest first"], ["follow_up", "Next follow-up"], ["last_contacted", "Longest since contact"]]} />
        </Suspense>
      </div>
      <Suspense><FilterSummary /></Suspense>
      {!list.length ? (
        <div className="card empty">{filtered ? <><strong>No one matches.</strong>Try another search, or clear the filters above.</> : <><strong>Your Rolodex is empty.</strong>Add your first contact, or import a spreadsheet.</>}</div>
      ) : (
        <Directory key={JSON.stringify([sp.q ?? "", sp.tag ?? "", sp.kind ?? "", sort])} kind="contacts" initial={directory} params={sp} />
      )}
    </>
  );
}
