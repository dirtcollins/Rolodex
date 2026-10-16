"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompanyListItem, ContactListItem, DirectoryPage } from "@/lib/data";
import { dayLabel, dueState, kindLabel, webText } from "@/lib/format";
import { ReachButtons } from "./reach";
import { CompanyAvatar } from "./company-avatar";
import { ContactAvatar } from "./contact-avatar";

type Item = ContactListItem | CompanyListItem;
type Props = { kind: "contacts" | "companies"; initial: DirectoryPage<Item>; params: Record<string, string | undefined> };

/** Small first batch; more rows arrive as the user approaches the end of the directory. */
export function Directory({ kind, initial, params }: Props) {
  const query = useMemo(() => {
    const sp = new URLSearchParams();
    for (const key of kind === "contacts" ? ["q", "tag", "kind", "sort"] : ["q", "tag", "industry", "sort"]) {
      if (params[key]) sp.set(key, params[key]!);
    }
    sp.sort();
    return sp.toString();
  }, [kind, params]);
  const storageKey = "rx-directory:" + kind + "?" + query;
  const [directory, setDirectory] = useState(initial), current = useRef(initial);
  const [loading, setLoading] = useState(false), busy = useRef(false);
  const [error, setError] = useState(""), [manualLoading, setManualLoading] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(initial.page);
  const sentinel = useRef<HTMLDivElement>(null), abort = useRef<AbortController | null>(null), generation = useRef(0);

  useEffect(() => {
    generation.current++;
    abort.current?.abort(); busy.current = false;
    current.current = initial; setDirectory(initial); setLoading(false); setError("");
    let saved = initial.page;
    try { saved = Number(sessionStorage.getItem(storageKey)) || initial.page; } catch { /* Storage is optional. */ }
    setRestoreTarget(Math.min(initial.pages, Math.max(initial.page, Number.isSafeInteger(saved) ? saved : initial.page)));
    return () => { generation.current++; abort.current?.abort(); };
  }, [initial, storageKey]);

  const loadMore = useCallback(async () => {
    const before = current.current;
    if (busy.current || before.page >= before.pages) return;
    const version = generation.current, controller = new AbortController();
    abort.current = controller; busy.current = true; setLoading(true); setError("");
    const sp = new URLSearchParams(query);
    // The API reserves kind for the directory; retain the contact's own kind filter separately.
    if (kind === "contacts" && sp.has("kind")) { sp.set("contactKind", sp.get("kind")!); sp.delete("kind"); }
    sp.set("kind", kind); sp.set("page", String(before.page + 1));
    try {
      const response = await fetch("/api/directory?" + sp, { signal: controller.signal, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "More records could not be loaded.");
      if (controller.signal.aborted || generation.current !== version) return;
      const next = result as DirectoryPage<Item>, seen = new Set(before.items.map(item => item.id));
      const merged = { ...next, items: [...before.items, ...next.items.filter(item => !seen.has(item.id))] };
      current.current = merged; setDirectory(merged);
      try { sessionStorage.setItem(storageKey, String(merged.page)); } catch { /* Storage is optional. */ }
    } catch (cause) {
      if (!controller.signal.aborted && generation.current === version)
        setError(cause instanceof Error ? cause.message : "More records could not be loaded.");
    } finally {
      if (generation.current === version) { busy.current = false; setLoading(false); }
    }
  }, [kind, query, storageKey]);

  const restoring = directory.page < Math.min(restoreTarget, directory.pages);
  useEffect(() => { if (restoring && !loading && !error) void loadMore(); }, [restoring, loading, error, loadMore, directory.page]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || error || directory.page >= directory.pages) return;
    if (typeof IntersectionObserver === "undefined") { setManualLoading(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [directory.page, directory.pages, error, loadMore]);

  return <div data-directory-restoring={restoring ? "true" : undefined}>
    <div className="rows">
      {kind === "contacts" ? <div className="row row-head has-reach"><span>Name</span><span>Company</span><span>Next follow-up</span><span>Last in touch</span><span /></div>
        : <div className="row row-head"><span>Company</span><span>People</span><span>Next follow-up</span><span>Website</span></div>}
      {directory.items.map(item => kind === "contacts" ? <ContactRow key={item.id} contact={item as ContactListItem} /> : <CompanyRow key={item.id} company={item as CompanyListItem} />)}
    </div>
    <div ref={sentinel} className="directory-status" aria-live="polite" aria-atomic="true" aria-busy={loading}>
      {error ? <><span>{error}</span><button type="button" className="btn btn-sm" onClick={() => void loadMore()}>Try again</button></>
        : loading ? <span>Loading more {kind}…</span>
        : <><span>{directory.items.length.toLocaleString()} of {directory.total.toLocaleString()} {kind}</span>{manualLoading && directory.page < directory.pages && <button type="button" className="btn btn-sm" onClick={() => void loadMore()}>Load more {kind}</button>}</>}
    </div>
  </div>;
}

function ContactRow({ contact: c }: { contact: ContactListItem }) {
  return <div className="row has-reach tap" data-kind="contact" data-id={c.id} data-name={c.name} data-href={"/contacts/" + c.id}>
    <span className="who"><ContactAvatar id={c.id} name={c.name} /><span style={{ minWidth: 0 }}><strong>{c.name}</strong><small>{[c.job_title, ...c.kinds.map(kindLabel)].filter(Boolean).join(" · ") || "No title yet"}</small></span></span>
    <span className="cell">{c.companies.map(x => x.name).join(", ") || <span className="muted">—</span>}</span>
    <span className={"cell" + (dueState(c.next_follow_up) ? " is-" + dueState(c.next_follow_up) : "")}>{dayLabel(c.next_follow_up) || <span className="muted">—</span>}</span>
    <span className="cell">{dayLabel(c.last_contacted) || <span className="muted">Never</span>}</span>
    <ReachButtons who={{ name: c.name, phones: c.phones, emails: c.emails, log: { contact_id: c.id } }} />
    <Link prefetch={false} href={"/contacts/" + c.id} className="tap-link" aria-label={"Open " + c.name} />
  </div>;
}
function CompanyRow({ company: co }: { company: CompanyListItem }) {
  return <Link prefetch={false} href={"/companies/" + co.id} className="row" data-kind="company" data-id={co.id} data-name={co.name} data-href={"/companies/" + co.id}>
    <span className="who"><CompanyAvatar id={co.id} name={co.name} /><span style={{ minWidth: 0 }}><strong>{co.name}</strong><small>{[co.industry, co.city].filter(Boolean).join(" · ") || "No industry yet"}</small></span></span>
    <span className="cell">{co.people ? co.people + (co.people === 1 ? " person" : " people") : <span className="muted">—</span>}</span>
    <span className={"cell" + (dueState(co.next_follow_up) ? " is-" + dueState(co.next_follow_up) : "")}>{dayLabel(co.next_follow_up) || <span className="muted">—</span>}</span>
    <span className="cell">{co.website ? webText(co.website) : <span className="muted">—</span>}</span>
  </Link>;
}
