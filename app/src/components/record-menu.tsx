"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { save, toast } from "./ui";
import { Icon } from "./icons";
import { AnchoredMenu } from "./anchored-menu";

// Right-click (or a long press on a phone) on anything in Rolodex: Open, Select, Delete. Select picks many of the same
// kind and deletes them at once (Brendan 10-15: "right click and click delete … mass delete as well"). Everything goes
// to Recently Deleted, with Undo.
//
// A screen opts a card or row in with three attributes, nothing else:
//   data-kind="contact" (contact, company, note, todo, opportunity, lead, relationship, campaign, template)
//   data-id={id}  data-name={what it's called, for the toast}
// Open follows the row's own .tap-link (or data-href), or presses it when it opens a popup.

const NAMES: Record<string, [string, string]> = {
  contact: ["contact", "contacts"], company: ["company", "companies"], note: ["note", "notes"], todo: ["to-do", "to-dos"],
  opportunity: ["project", "projects"], lead: ["lead", "leads"], relationship: ["connection", "connections"],
  campaign: ["campaign", "campaigns"], template: ["template", "templates"],
};
const counted = (kind: string, n: number) => n + " " + (NAMES[kind]?.[n === 1 ? 0 : 1] ?? "items");
const SKIP = "input, textarea, select, [contenteditable], .popup, .ctx-menu, .select-bar";

type Menu = { x: number; y: number; el: HTMLElement };
type Picked = { kind: string; ids: number[] };

const recordOf = (t: EventTarget | null) => {
  const el = t instanceof Element ? t : null;
  if (!el || el.closest(SKIP)) return null;
  const rec = el.closest<HTMLElement>("[data-kind][data-id]");
  return rec && NAMES[rec.dataset.kind!] && Number(rec.dataset.id) > 0 ? rec : null;
};
const hrefOf = (el: HTMLElement) => el.dataset.href || (el instanceof HTMLAnchorElement ? el.getAttribute("href") : "") || el.querySelector<HTMLAnchorElement>(":scope > a.tap-link")?.getAttribute("href") || "";
/** A row that opens a popup instead of a page (a to-do): Open presses its stretched button. */
const tapButtonOf = (el: HTMLElement) => el.querySelector<HTMLButtonElement>(":scope > button.tap-link");

export function RecordMenu() {
  const router = useRouter(), path = usePathname();
  useEffect(() => { setPicked(null); setMenu(null); }, [path]);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const pickedRef = useRef<Picked | null>(null);
  pickedRef.current = picked;
  const deleting = useRef(new Set<string>());
  const [removing, setRemoving] = useState(0);

  // Show which ones are picked, and keep showing it when the page refreshes under them.
  useEffect(() => {
    const paint = () => {
      document.querySelectorAll<HTMLElement>("[data-picked]").forEach((el) => el.removeAttribute("data-picked"));
      document.body.classList.toggle("is-selecting", !!picked);
      if (!picked) return;
      document.querySelectorAll<HTMLElement>(`[data-kind="${picked.kind}"][data-id]`).forEach((el) => { if (picked.ids.includes(Number(el.dataset.id))) el.setAttribute("data-picked", ""); });
    };
    paint();
    if (!picked) return;
    const watch = new MutationObserver(() => { watch.disconnect(); paint(); watch.observe(document.body, { childList: true, subtree: true }); });
    watch.observe(document.body, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [picked]);

  useEffect(() => {
    const open = (el: HTMLElement, x: number, y: number) => setMenu({ el, x, y });
    const onContext = (e: MouseEvent) => {
      const rec = recordOf(e.target);
      if (!rec) return;
      e.preventDefault();
      open(rec, e.clientX, e.clientY);
    };
    // A long press on a phone opens the same menu; the tap that ends it doesn't also open the record.
    let timer: ReturnType<typeof setTimeout> | undefined, start = { x: 0, y: 0 }, swallow = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const rec = recordOf(e.target);
      if (!rec) return;
      start = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => { swallow = true; navigator.vibrate?.(10); open(rec, start.x, start.y); }, 520);
    };
    const move = (e: PointerEvent) => { if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) { clearTimeout(timer); timer = undefined; } };
    const up = () => { clearTimeout(timer); timer = undefined; };
    // While selecting, a click on a record of that kind picks it instead of opening it.
    const click = (e: MouseEvent) => {
      if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); return; }
      const p = pickedRef.current;
      if (!p) return;
      const rec = recordOf(e.target);
      if (!rec || rec.dataset.kind !== p.kind) return;
      e.preventDefault(); e.stopPropagation();
      const id = Number(rec.dataset.id);
      setPicked({ kind: p.kind, ids: p.ids.includes(id) ? p.ids.filter((x) => x !== id) : [...p.ids, id] });
    };
    const startPicking = (e: Event) => setPicked({ kind: String((e as CustomEvent).detail), ids: [] });
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(null); if (pickedRef.current && !document.querySelector(".popup")) setPicked(null); } };
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key);
    addEventListener("rx-select", startPicking);
    return () => {
      removeEventListener("rx-select", startPicking);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key);
    };
  }, []);

  const remove = async (kind: string, ids: number[], name?: string) => {
    const keys = ids.map((id) => kind + ":" + id);
    if (keys.some((key) => deleting.current.has(key))) return false;
    keys.forEach((key) => deleting.current.add(key));
    setRemoving((n) => n + 1);
    const r = await save("delete.many", { kind, ids });
    keys.forEach((key) => deleting.current.delete(key));
    setRemoving((n) => n - 1);
    if (!r.ok) { toast(r.error ?? "That didn’t delete.", true); return false; }
    // A record's own page goes back to its list when that record is deleted.
    const own = ids.some((id) => location.pathname.replace(/\/$/, "").endsWith("/" + id) && document.querySelector(`[data-kind="${kind}"][data-id="${id}"][data-self]`));
    // Invalidate cached list and record payloads before opening another view.
    router.refresh();
    if (own) router.push(location.pathname.replace(/\/\d+$/, ""));
    toast((ids.length === 1 && name ? name : counted(kind, ids.length)) + " deleted", false, async () => {
      const b = await save("restore", { kind, ids });
      if (!b.ok) toast(b.error ?? "That didn’t come back.", true);
      else { toast("Brought back"); router.refresh(); }
    });
    return true;
  };

  const m = menu, kind = m?.el.dataset.kind ?? "", id = Number(m?.el.dataset.id), name = m?.el.dataset.name ?? "", href = m ? hrefOf(m.el) : "", tapButton = m && !href ? tapButtonOf(m.el) : null;
  const allOfKind = () => [...new Set([...document.querySelectorAll<HTMLElement>(`[data-kind="${picked?.kind}"][data-id]`)].map((el) => Number(el.dataset.id)))];

  return (
    <>
      {m && (
        <AnchoredMenu anchor={m.el} point={{ x: m.x, y: m.y }} onClose={() => setMenu(null)} className="ctx-menu" matchWidth={false} minWidth={200} role="menu" ariaLabel={name ? "Actions for " + name : "Record actions"}>
          {name && <div className="ctx-title">{name}</div>}
          {(href || tapButton) && <button type="button" role="menuitem" onClick={() => { setMenu(null); if (href) router.push(href); else tapButton!.click(); }}><Icon name="chevron" />Open</button>}
          <button type="button" role="menuitem" onClick={() => { setMenu(null); setPicked({ kind, ids: picked?.kind === kind ? [...new Set([...picked.ids, id])] : [id] }); }}><Icon name="check" />Select</button>
          <button type="button" role="menuitem" className="is-bad" onClick={() => { setMenu(null); void remove(kind, [id], name); }}><Icon name="deleted" />Delete</button>
        </AnchoredMenu>
      )}
      {picked && document.getElementById("selection-controls") && createPortal(
        <div className="selection-toolbar" role="toolbar" aria-label="Selected">
          <strong>{picked.ids.length ? counted(picked.kind, picked.ids.length) + " selected" : "Pick " + (NAMES[picked.kind]?.[1] ?? "items")}</strong>
          <button type="button" className="btn btn-sm" title="Select all records currently loaded on this page" onClick={() => setPicked({ kind: picked.kind, ids: allOfKind() })}>{document.querySelector(".directory-status") ? "Select all loaded" : "Select all"}</button>
          <span className="grow" />
          <button type="button" className="btn btn-sm" onClick={() => setPicked(null)}>Cancel</button>
          <button type="button" className="btn btn-sm btn-danger-solid" disabled={!picked.ids.length || removing > 0} onClick={async () => { if (await remove(picked.kind, picked.ids)) setPicked(null); }}>Delete</button>
        </div>, document.getElementById("selection-controls")!
      )}
    </>
  );
}

/** A "Select" button for a list page's header: starts picking records of that kind, as right-click → Select does. */
export function SelectButton({ kind }: { kind: string }) {
  return <button type="button" className="btn" onClick={() => window.dispatchEvent(new CustomEvent("rx-select", { detail: kind }))}><Icon name="check" />Select</button>;
}
