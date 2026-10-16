"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

type Result = { ok: boolean; id?: number; ids?: number[]; error?: string; [more: string]: unknown };
export async function save(action: string, data: Record<string, unknown>): Promise<Result> {
  try {
    const r = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }), cache: "no-store", keepalive: true });
    const b = await r.json().catch(() => ({}));
    if (r.status === 401) { location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search); return { ok: false, error: b.error }; }
    if (!r.ok || !b.ok) return { ok: false, error: b.error || "That didn’t save. Try again." };
    window.dispatchEvent(new Event("rx-saved"));
    return b;
  } catch { return { ok: false, error: "No connection. Check your connection and try again." }; }
}

/** Deduplicate repeat submissions without blocking independent actions. */
export function useSave() {
  const router = useRouter();
  const [refreshing, start] = useTransition(), [pending, setPending] = useState(0);
  const flights = useRef(new Map<string, Promise<Result>>());
  const run = (action: string, data: Record<string, unknown>, done?: string): Promise<Result> => {
    const key = action + JSON.stringify(data), existing = flights.current.get(key);
    if (existing) return existing;
    setPending((n) => n + 1);
    const task = save(action, data).then((r) => {
      if (!r.ok) toast(r.error ?? "That didn’t save.", true);
      else { if (done) toast(done); start(() => router.refresh()); }
      return r;
    }).finally(() => { flights.current.delete(key); setPending((n) => n - 1); });
    flights.current.set(key, task);
    return task;
  };
  return { run, busy: refreshing || pending > 0 };
}

type ToastMsg = { text: string; bad?: boolean; undo?: () => void };
let toastSequence = 0;
export function toast(text: string, bad = false, undo?: () => void) {
  window.dispatchEvent(new CustomEvent<ToastMsg>("rx-toast", { detail: { text, bad, undo } }));
}
function ToastItem({ message: m, dismiss }: { message: ToastMsg; dismiss: () => void }) {
  const [paused, setPaused] = useState(false), close = useRef(dismiss);
  close.current = dismiss;
  useEffect(() => { if (paused) return; const t = setTimeout(() => close.current(), m.undo ? 10000 : m.bad ? 7000 : 4000); return () => clearTimeout(t); }, [m, paused]);
  return <div className={"toast" + (m.bad ? " is-bad" : "")} role={m.bad ? "alert" : "status"} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}>
    <Icon name={m.bad ? "close" : "check"} /><span>{m.text}</span>
    {m.undo && <button type="button" onClick={() => { m.undo!(); dismiss(); }}>Undo</button>}
    <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={dismiss}><Icon name="close" /></button>
  </div>;
}
export function Toasts() {
  const [messages, setMessages] = useState<(ToastMsg & { id: number })[]>([]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const show = (e: Event) => setMessages((old) => [...old, { ...(e as CustomEvent<ToastMsg>).detail, id: ++toastSequence }]);
    window.addEventListener("rx-toast", show);
    return () => window.removeEventListener("rx-toast", show);
  }, []);
  useEffect(() => {
    const sync = () => setHost([...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) ?? document.body);
    sync(); window.addEventListener("rx-modal", sync);
    return () => window.removeEventListener("rx-modal", sync);
  }, []);
  const stack = <div className="toast-stack" aria-label="Notifications">{messages.slice(0, 4).map((m) => <ToastItem key={m.id} message={m} dismiss={() => setMessages((old) => old.filter((x) => x.id !== m.id))} />)}</div>;
  return host ? createPortal(stack, host) : null;
}

export function useDelete() {
  const { run } = useSave();
  return async (kind: "contact" | "company" | "note" | "todo" | "opportunity" | "lead", id: number, after?: () => void) => {
    const r = await run(kind + ".delete", { id });
    if (!r.ok) return;
    after?.();
    toast({ contact: "Contact deleted", company: "Company deleted", note: "Note deleted", todo: "To-do deleted", opportunity: "Project deleted", lead: "No longer a lead" }[kind], false, () => { void run("restore", { kind, id }, "Restored"); });
  };
}

/** Native modal top layer provides focus containment and an inert background, including nested dialogs. */
export function Popup({ title, onClose, children, foot, wide, guard = true }: { title: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; wide?: boolean; guard?: boolean }) {
  const box = useRef<HTMLDialogElement>(null), close = useRef(onClose), dirty = useRef(false);
  const [mounted, setMounted] = useState(false), [discard, setDiscard] = useState(false);
  close.current = onClose;
  const requestClose = () => { if (guard && dirty.current) setDiscard(true); else close.current(); };
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const was = document.activeElement as HTMLElement | null, dialog = box.current;
    const overflow = document.documentElement.style.overflow;
    dialog?.showModal();
    window.dispatchEvent(new Event("rx-modal"));
    const draftChanged = () => { dirty.current = true; };
    dialog?.addEventListener("rx-draft-change", draftChanged);
    document.documentElement.style.overflow = "hidden";
    (dialog?.querySelector<HTMLElement>("[autofocus]") ?? dialog?.querySelector<HTMLElement>("input:not([type=hidden]),textarea,select") ?? dialog?.querySelector<HTMLElement>("button"))?.focus();
    return () => { dialog?.removeEventListener("rx-draft-change", draftChanged); dialog?.close(); window.dispatchEvent(new Event("rx-modal")); document.documentElement.style.overflow = overflow; if (was?.isConnected) was.focus({ preventScroll: true }); };
  }, [mounted]);
  useEffect(() => { if (discard) box.current?.querySelector<HTMLElement>("[data-keep]")?.focus(); }, [discard]);
  if (!mounted) return null;
  return createPortal(
    <dialog ref={box} className="scrim" aria-label={title} onKeyDown={(e) => {
      if (e.key !== "Tab") return;
      const nodes = [...(box.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') ?? [])].filter(el => el.getClientRects().length > 0 && !el.closest('[hidden]'));
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement as HTMLElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement as HTMLElement))) { e.preventDefault(); first.focus(); }
    }} onCancel={(e) => { e.preventDefault(); requestClose(); }} onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <div className={"popup" + (wide ? " is-wide" : "")} onChangeCapture={() => { dirty.current = true; }} onClickCapture={(e) => {
        // Existing forms' Cancel buttons also use the same draft protection.
        const button = (e.target as Element).closest('button');
        if (button?.textContent?.trim() === 'Cancel' && guard && dirty.current) { e.preventDefault(); e.stopPropagation(); setDiscard(true); }
      }}>
        <div className="popup-head"><h2>{discard ? "Discard changes?" : title}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={requestClose}><Icon name="close" /></button></div>
        {discard && <div className="popup-body discard-copy"><p>Your changes haven’t been saved.</p><div className="page-acts"><button data-keep type="button" className="btn" onClick={() => setDiscard(false)}>Keep editing</button><button type="button" className="btn btn-danger-solid" onClick={() => close.current()}>Discard changes</button></div></div>}
        <div className="popup-body" hidden={discard}>{children}</div>
        {foot && <div className="popup-foot" hidden={discard}>{foot}</div>}
      </div>
    </dialog>, document.body);
}
export function useOpen(initial = false) {
  const [open, setOpen] = useState(initial);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}
