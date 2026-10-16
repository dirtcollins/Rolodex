"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BellRow } from "@/lib/bell";
import { Icon } from "./icons";
import { Popup, toast } from "./ui";

// Light Ops 2.0's bell and notification tray (components/bell.tsx there), brought over 2026-10-15: worked out live from
// the records (lib/bell.ts), newest first. A row opens its record and is read; Mark all read; the unread count leads
// the tab title ("(3) Rolodex"). A row's X (on hover or focus; always on a phone) or Clear all takes it out of this
// person's bell at once, saved behind it, with Undo; if the save fails it comes back and says so.
// It loads itself after the page shows (/api/bell), and again when it's opened, after a save, when the window comes
// back, and on a page change once its list is over a minute old, so pages never wait on it.
// The desktop and phone bells share every load: a load already on its way is used by anyone who asked at or after it
// started, while a save, a return or an open after it started asks again. Only the newest answer is shown, and a failed
// load keeps the last good list.
const STALE = 60_000;
/**
 * A save (read, read-all, dismiss, dismiss-all, undismiss; app/api/bell): kept for this person in the database, and
 * checked, so the bell never shows one as done that wasn't. Answers the ids a dismiss-all took.
 */
async function save(action: string, ids: string[] = []): Promise<string[]> {
  // keepalive (Light Ops, 2026-10-14): opening a notification saves it read AND leaves the page; a whole-page load
  // (the first click after a release) would cancel the save, so read ones came back unread. keepalive lets it finish.
  const r = await fetch("/api/bell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ids }), cache: "no-store", keepalive: true });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.ok) throw new Error("not saved");
  return b.ids ?? [];
}
const twice = <T,>(go: () => Promise<T>) => go().catch(() => new Promise<T>((ok, bad) => window.setTimeout(() => go().then(ok, bad), 1500)));
let inflight: { at: number; p: Promise<BellRow[]> } | null = null, latest: BellRow[] = [], okAt = 0, seq = 0, applied = 0;
function loadRows(since = 0): Promise<BellRow[]> {
  if (inflight && inflight.at >= since) return inflight.p;
  const id = ++seq, p = fetch("/api/bell", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((b: { rows: BellRow[] }) => { if (id > applied) { applied = id; latest = b.rows; okAt = performance.now(); } return latest; }, () => latest);
  inflight = { at: performance.now(), p };
  void p.then(() => { if (inflight?.p === p) inflight = null; });
  return p;
}

export function Bell({ phone }: { phone?: boolean }) {
  const [rows, setRows] = useState<BellRow[]>([]);
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  // Dismissed here (shown gone at once, before and after the server has it) and on their way out (the fade).
  const [gone, setGone] = useState<Set<string>>(new Set()), [leaving, setLeaving] = useState<Set<string>>(new Set());
  // A copy of each dismissed row, so Undo shows it again at once (a reload meanwhile no longer has it).
  const kept = useRef(new Map<string, BellRow>());
  const box = useRef<HTMLDivElement>(null), path = usePathname();
  const isRead = (r: BellRow) => r.read || read.has(r.id);
  const shown = rows.filter((r) => !gone.has(r.id));
  const unread = shown.filter((r) => !isRead(r)).map((r) => r.id);
  const n = unread.length;
  // Read at once; saved behind it (all: Mark all read, everything the bell could show). If it can't be saved, it's unread again and says so.
  const mark = (ids: string[], all = false) => {
    if (!ids.length) return;
    setRead((s) => new Set([...s, ...ids]));
    twice(() => save(all ? "read-all" : "read", ids)).catch(() => {
      setRead((s) => new Set([...s].filter((x) => !ids.includes(x))));
      toast(all ? "Couldn’t mark them read. Check your connection and try again." : "Couldn’t mark that read.", true);
    });
  };
  const add = (s: Set<string>, ids: string[]) => new Set([...s, ...ids]), drop = (s: Set<string>, ids: string[]) => new Set([...s].filter((x) => !ids.includes(x)));
  const dismiss = (ids: string[], all = false) => {
    if (!ids.length) return;
    rows.forEach((r) => { if (ids.includes(r.id)) kept.current.set(r.id, r); });
    setLeaving((s) => add(s, ids));
    // The fade, then gone, unless the save has already failed (then it stays, see below).
    let failed = false;
    window.setTimeout(() => { if (!failed) setGone((s) => add(s, ids)); setLeaving((s) => drop(s, ids)); }, 180);
    // Clear all: the server clears every one (older ones past the list too) and says which, for Undo.
    twice(() => (all ? save("dismiss-all") : save("dismiss", ids).then(() => ids)))
      .then((done) => { setGone((s) => add(s, done)); toast(all ? "Cleared all notifications" : "Dismissed", false, () => undo(done)); })
      .catch(() => { failed = true; setGone((s) => drop(s, ids)); setLeaving((s) => drop(s, ids)); toast("Couldn’t dismiss that. Check your connection and try again.", true); });
  };
  const undo = (ids: string[]) => {
    setGone((s) => drop(s, ids));
    setRows((r) => [...r, ...ids.map((id) => kept.current.get(id)).filter((x): x is BellRow => !!x && !r.some((y) => y.id === x.id))].sort((a, b) => b.at.localeCompare(a.at)));
    // Back on the server: the list as it is now (the older ones a Clear all took come back too).
    twice(() => save("undismiss", ids)).then(() => loadRows(performance.now()).then(setRows))
      .catch(() => { setGone((s) => add(s, ids)); toast("Couldn’t bring that back. Check your connection and try again.", true); });
  };
  useEffect(() => {
    let on = true;
    const show = (p: Promise<BellRow[]>) => p.then((r) => { if (on) setRows(r); });
    show(okAt ? Promise.resolve(latest) : loadRows());
    // The same event reaches both bells with one timeStamp, so they share the load it starts.
    const back = (e: Event) => { if (document.visibilityState === "visible") show(loadRows(e.timeStamp)); };
    const saved = (e: Event) => show(loadRows(e.timeStamp));
    document.addEventListener("visibilitychange", back);
    window.addEventListener("rx-saved", saved);
    return () => { on = false; document.removeEventListener("visibilitychange", back); window.removeEventListener("rx-saved", saved); };
  }, []);
  // A page change: only when the list is over a minute old (Light Ops, 2026-10-11).
  useEffect(() => { if (okAt && performance.now() - okAt > STALE) loadRows().then(setRows); }, [path]);
  useEffect(() => { if (open) loadRows(performance.now()).then(setRows); }, [open]);
  useEffect(() => {
    if (phone) return;
    // No trailing space when the title is briefly empty mid-navigation: the browser trims it, the titles never match
    // and the observer loops forever.
    const apply = () => { const t = document.title.replace(/^\(\d+\+?\)\s*/, ""), want = [n ? "(" + (n > 99 ? "99+" : n) + ")" : "", t].filter(Boolean).join(" "); if (document.title !== want) document.title = want; };
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [n, phone]);
  return (
    <div className="notif" ref={box}>
      <button type="button" className="notif-btn" aria-label={"Notifications" + (n ? `, ${n} unread` : "")} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="bell" />{n > 0 && <span className="notif-count">{n > 99 ? "99+" : n}</span>}
      </button>
      {open && <Popup title="Notifications" onClose={() => setOpen(false)} guard={false}><div className="notifications-content">
        
        <div className="notification-head"><div><small>{n ? n + " unread" : "All caught up"}</small></div>
          <span className="notification-acts"><button type="button" className="link notification-mark" disabled={!n} onClick={() => mark(unread, true)}>Mark all read</button>
            <button type="button" className="link notification-mark" disabled={!shown.length} onClick={() => dismiss(shown.map((r) => r.id), true)}>Clear all</button></span></div>
        <div className="notification-list">
          {shown.map((r) => (
            <div key={r.id} className={"notification-item" + (leaving.has(r.id) ? " is-leaving" : "")}>
              <Link className={"notification-row" + (isRead(r) ? " read" : "")} href={r.href} onClick={() => { if (!isRead(r)) mark([r.id]); setOpen(false); }}>
                <span className={"status-dot " + r.tone} aria-hidden="true" />
                <span className="notification-copy"><span className="notification-line"><strong>{r.title}</strong><time dateTime={r.at}>{r.when}</time></span>
                  <small>{r.body}</small>{r.cta && <span className="notification-cta">{r.cta} <span aria-hidden="true">→</span></span>}</span>
              </Link>
              <button type="button" className="notification-x" aria-label={"Dismiss: " + r.title} title="Dismiss" onClick={() => dismiss([r.id])}><Icon name="close" /></button>
            </div>))}
          {!shown.length && <p className="notification-empty">You’re all caught up.</p>}
        </div>
      </div></Popup>}
    </div>
  );
}
