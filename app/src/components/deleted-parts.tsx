"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Popup, toast, useSave } from "./ui";
import type { DeletedSnapshotItem } from "@/lib/purge-deleted";
import type { DeletedBatch } from "@/lib/deleted-directory";
import { when } from "@/lib/format";
import { Icon } from "./icons";

/** Restore one deleted thing; the list refreshes and it's gone from here. */
export function RestoreButton({ kind, id, title }: { kind: string; id: number; title: string }) {
  const { run, busy } = useSave();
  return <button type="button" className="btn btn-sm" disabled={busy} aria-label={"Restore " + title} onClick={() => run("restore", { kind, id }, "Brought back")}>Restore</button>;
}

export function DeleteAllButton({ items, cutoff }: { items: DeletedSnapshotItem[]; cutoff: string }) {
  const { run, busy } = useSave();
  const [review, setReview] = useState<{ items: DeletedSnapshotItem[]; cutoff: string } | null>(null);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) { setReview(null); setError(""); } };
  const purge = async () => {
    if (!review || submitting.current) return;
    submitting.current = true;
    setError("");
    try {
      const result = await run("deleted.purge", { ...review, confirm: "permanently-delete" });
      if (!result.ok) { setError(result.error ?? "Nothing was deleted. Try again."); return; }
      const removed = Number(result.removed ?? 0), retained = Number(result.retained ?? 0);
      setReview(null);
      toast(`${removed.toLocaleString()} ${removed === 1 ? "record" : "records"} permanently deleted.` + (retained ? ` ${retained.toLocaleString()} kept because they are linked to other data or have changed.` : ""));
    } finally { submitting.current = false; }
  };
  return <>
    <button type="button" className="btn btn-danger" disabled={!items.length || busy} onClick={() => { setError(""); setReview({ items: items.map(({ kind, id, deleted_at }) => ({ kind, id, deleted_at })), cutoff }); }}>Delete all</button>
    {review && <Popup title="Permanently delete these records?" onClose={close} guard={false} foot={<>
      <span className="grow" />
      <button type="button" className="btn" disabled={busy} onClick={close}>Cancel</button>
      <button type="button" className="btn btn-danger-solid" disabled={busy} onClick={purge}>{busy ? "Deleting…" : `Delete ${review.items.length.toLocaleString()} permanently`}</button>
    </>}>
      <div className="form-grid">
        <p style={{ margin: 0 }}>This permanently removes all <strong>{review.items.length.toLocaleString()} {review.items.length === 1 ? "record" : "records"}</strong> in Recently Deleted when this page loaded, including records further down the list. This cannot be undone.</p>
        <p className="muted" style={{ margin: 0 }}>Records linked to other data are kept to protect contacts, companies, projects, and history. Anything restored or newly deleted after this page loaded is also kept.</p>
        {error && <p className="form-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>
    </Popup>}
  </>;
}

const KIND: Record<string, { label: string; icon: string }> = {
  campaign: { label: "Campaign", icon: "outreach" }, template: { label: "Template", icon: "mail" },
  contact: { label: "Contact", icon: "contacts" }, company: { label: "Company", icon: "companies" },
  note: { label: "Note", icon: "edit" }, todo: { label: "To-do", icon: "todos" }, opportunity: { label: "Project", icon: "pipeline" },
};
const STORAGE_KEY = "rx-directory:deleted";

/** Restore remains per record; scrolling retrieves only the next fifty previews. */
export function DeletedList({ initial, total }: { initial: DeletedBatch; total: number }) {
  const [batch, setBatch] = useState(initial), current = useRef(initial);
  const [loading, setLoading] = useState(false), flight = useRef(false);
  const [error, setError] = useState(""), [restoreTarget, setRestoreTarget] = useState(1);
  const sentinel = useRef<HTMLDivElement>(null), abort = useRef<AbortController | null>(null), generation = useRef(0);
  useEffect(() => {
    generation.current++;
    abort.current?.abort(); flight.current = false;
    current.current = initial; setBatch(initial); setLoading(false); setError("");
    let target = 1;
    try { target = Number(sessionStorage.getItem(STORAGE_KEY)) || 1; } catch { /* Storage is optional. */ }
    setRestoreTarget(Math.min(Math.max(1, Math.ceil(total / 50)), Number.isSafeInteger(target) ? target : 1));
    return () => { generation.current++; abort.current?.abort(); };
  }, [initial, total]);
  const loadMore = useCallback(async () => {
    const before = current.current;
    if (flight.current || !before.more) return;
    const version = generation.current, controller = new AbortController();
    abort.current = controller; flight.current = true; setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(before.page + 1), cutoff: before.cutoff });
      const response = await fetch("/api/deleted?" + params, { signal: controller.signal, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "More deleted records could not be loaded.");
      if (controller.signal.aborted || generation.current !== version) return;
      const next = result as DeletedBatch, seen = new Set(before.items.map(item => item.kind + ":" + item.id));
      const merged = { ...next, items: [...before.items, ...next.items.filter(item => !seen.has(item.kind + ":" + item.id))] };
      current.current = merged; setBatch(merged);
      try { sessionStorage.setItem(STORAGE_KEY, String(merged.page)); } catch { /* Storage is optional. */ }
    } catch (cause) {
      if (!controller.signal.aborted && version === generation.current)
        setError(cause instanceof Error ? cause.message : "More deleted records could not be loaded.");
    } finally {
      if (version === generation.current) { flight.current = false; setLoading(false); }
    }
  }, []);
  const restoring = batch.page < restoreTarget && batch.more;
  useEffect(() => { if (restoring && !loading && !error) void loadMore(); }, [restoring, loading, error, loadMore, batch.page]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || error || !batch.more) return;
    if (typeof IntersectionObserver === "undefined") { void loadMore(); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [batch.page, batch.more, error, loadMore]);
  return <div data-directory-restoring={restoring ? "true" : undefined}>
    <div className="card card-pad recovery-list">
      {batch.items.map(item => {
        const kind = KIND[item.kind] ?? { label: item.kind, icon: "deleted" };
        return <div key={item.kind + ":" + item.id} className="reach-item">
          <span className="avatar"><Icon name={kind.icon} /></span>
          <div className="reach-copy"><strong style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.title || "Untitled"}</strong>
            <small>{[kind.label, item.sub, "Deleted " + when(item.deleted_at)].filter(Boolean).join(" · ")}</small></div>
          <RestoreButton kind={item.kind} id={item.id} title={item.title} />
        </div>;
      })}
    </div>
    <div ref={sentinel} className="directory-status" aria-live="polite" aria-atomic="true" aria-busy={loading}>
      {error ? <><span>{error}</span><button type="button" className="btn btn-sm" onClick={() => void loadMore()}>Try again</button></>
        : loading ? <span>Loading more deleted records…</span>
        : <span>{batch.items.length.toLocaleString()} of {total.toLocaleString()} deleted records</span>}
    </div>
  </div>;
}
