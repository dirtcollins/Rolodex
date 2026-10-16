"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSave } from "./ui";
import { Icon } from "./icons";
import { StageMenu } from "./stage-menu";
import { useParam } from "./list-tools";
import {
  OPEN_STAGES, OPP_STAGES, PIPELINE_OPEN_COOKIE, PIPELINE_SORTS, PIPELINE_SORT_COOKIE, PIPELINE_STAGE_COOKIE, PIPELINE_VIEW_COOKIE,
  dayLabel, dueState, money, moneyShort, remember, stageLabel, today,
} from "@/lib/format";
import type { Opportunity } from "@/lib/data";

// The Pipeline (Docs: 5. Pipeline): a board with a column per stage, or a list. Every pick is remembered (a cookie the
// page reads on the server, so it opens the same way with no flash): Board or List and the list's sort (also in the
// address, so a shared link opens the same), whether Won and Lost are open on the board, and the phone's stage.
//
// Moving a project: drag it (a mouse drags at once; a finger holds a moment first, so a swipe still scrolls), or its ···
// stage menu (keyboard and touch). Right-click / long-press is the app's record menu (record-menu.tsx): a drag only starts
// on movement, and a held finger that opened that menu doesn't drag.

export type View = "board" | "list";
export type Saved = { view: View; sort: string; open: string[]; stage: string };

function useView(saved: View): View {
  const v = useSearchParams().get("view");
  return v === "list" || v === "board" ? v : saved;
}
function useSort(saved: string): string {
  const v = useSearchParams().get("sort");
  return PIPELINE_SORTS.some(([s]) => s === v) ? v! : saved;
}
function useSetSort() {
  const set = useParam();
  return (v: string) => { remember(PIPELINE_SORT_COOKIE, v); set("sort", v); };
}
/** A phone (one stage at a time). False on the server; the CSS shows the right thing before this knows. */
const NARROW = "(max-width: 820px)";
function useNarrow() {
  return useSyncExternalStore((cb) => { const m = matchMedia(NARROW); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }, () => matchMedia(NARROW).matches, () => false);
}

export function ViewToggle({ saved }: { saved: View }) {
  const view = useView(saved), set = useParam();
  const pick = (v: View) => { remember(PIPELINE_VIEW_COOKIE, v); set("view", v); };
  return (
    <div className="chip-pick" role="radiogroup" aria-label="Show as">
      {(["board", "list"] as const).map((v) => <label key={v}><input type="radio" name="pipe-view" checked={view === v} onChange={() => pick(v)} /><span>{v === "board" ? "Board" : "List"}</span></label>)}
    </div>
  );
}

/** The list's sort (the board keeps its own order). */
export function PipelineSort({ saved }: { saved: Saved }) {
  const view = useView(saved.view), sort = useSort(saved.sort), setSort = useSetSort();
  if (view !== "list") return null;
  return (
    <select className="in" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
      {PIPELINE_SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

const CLOSED = ["won", "lost"];
const sum = (l: Opportunity[]) => l.reduce((n, o) => n + o.value_cents, 0);
const inStage = (items: Opportunity[], stage: string) => items.filter((o) => o.stage === stage).sort((a, b) => a.position - b.position);
/** A place between two cards: the midpoint, or one past the end. */
const between = (before?: Opportunity, after?: Opportunity) => (before && after ? (before.position + after.position) / 2 : before ? before.position + 1 : after ? after.position - 1 : 0);
const counted = (n: number) => n + (n === 1 ? " project" : " projects");

/** Where a dragged card would land: a stage, and its place there (null: the top, for a closed column or a phone tab). */
type Drag = { id: number; w: number; h: number; x: number; y: number; stage: string; index: number | null };
type Live = {
  id: number; el: HTMLElement; sx: number; sy: number; dx: number; dy: number; x: number; y: number; w: number; h: number;
  touch: boolean; armed: boolean; on: boolean; stage: string; index: number | null; timer?: ReturnType<typeof setTimeout>;
};

type MoveChange = { stage: string; position: number; pending: boolean; beforeId?: number; afterId?: number };
function mergeMoves(opps: Opportunity[], moves: Map<number, MoveChange>) {
  return opps.map((o) => {
    const move = moves.get(o.id);
    if (!move) return o;
    // The server renumbers stages: acknowledge relative order, not the temporary midpoint.
    const previous = opps.find((x) => x.id === move.beforeId && x.stage === move.stage);
    const following = opps.find((x) => x.id === move.afterId && x.stage === move.stage);
    if (!move.pending && o.stage === move.stage && (!previous || previous.position < o.position) && (!following || following.position > o.position)) {
      moves.delete(o.id);
      return o;
    }
    return { ...o, stage: move.stage, position: move.position };
  });
}

export function PipelineBoard({ opps, saved }: { opps: Opportunity[]; saved: Saved }) {
  const view = useView(saved.view), sort = useSort(saved.sort), narrow = useNarrow();
  const { run } = useSave();
  // Keep each move until refreshed data acknowledges it. A different card's refresh
  // must not erase an in-flight move, and one failure must not rewind the board.
  const moves = useRef(new Map<number, MoveChange>());
  const source = useRef(opps);
  source.current = opps;
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [items, setItems] = useState(opps), [was, setWas] = useState(opps);
  if (opps !== was) { setWas(opps); setItems(mergeMoves(opps, moves.current)); }
  const [open, setOpen] = useState<string[]>(saved.open);
  const [phone, setPhone] = useState(() => saved.stage || (OPP_STAGES.find(([s]) => opps.some((o) => o.stage === s))?.[0] ?? "lead"));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [scrollState, setScrollState] = useState({ overflow: false, left: false, right: false });
  const board = useRef<HTMLDivElement>(null), tabs = useRef<HTMLDivElement>(null), ghost = useRef<HTMLDivElement>(null), live = useRef<Live | null>(null);
  // The drag listeners are set once, so they read the latest of these.
  const itemsRef = useRef(items), moveRef = useRef<typeof move>(null!);
  // Each card's last place on the board, so a card that moves glides there.
  const places = useRef(new Map<number, { x: number; y: number }>());

  // Native scrolling stays available; visible arrows and edge fades reveal hidden stages.
  useLayoutEffect(() => {
    const node = board.current;
    if (!node || narrow || view !== "board") {
      setScrollState((old) => old.overflow ? { overflow: false, left: false, right: false } : old);
      return;
    }
    const update = () => {
      const max = Math.max(0, node.scrollWidth - node.clientWidth);
      const next = { overflow: max > 2, left: node.scrollLeft > 2, right: node.scrollLeft < max - 2 };
      setScrollState((old) => old.overflow === next.overflow && old.left === next.left && old.right === next.right ? old : next);
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(node);
    node.querySelectorAll("[data-stage]").forEach((column) => observer?.observe(column));
    addEventListener("resize", update);
    return () => { observer?.disconnect(); node.removeEventListener("scroll", update); removeEventListener("resize", update); };
  }, [view, narrow]);

  const scrollBoard = (direction: "left" | "right" | "start" | "end") => {
    const node = board.current;
    if (!node || narrow || live.current?.on) return;
    const columnWidth = node.querySelector<HTMLElement>("[data-stage]:not([data-collapsed])")?.getBoundingClientRect().width ?? 280;
    const step = Math.min(node.clientWidth * .85, columnWidth + 12);
    const left = direction === "start" ? 0 : direction === "end" ? node.scrollWidth : node.scrollLeft + (direction === "left" ? -step : step);
    node.scrollTo({ left, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  const isCollapsed = (stage: string) => CLOSED.includes(stage) && !open.includes(stage) && !narrow;
  const toggle = (stage: string) => {
    const next = open.includes(stage) ? open.filter((s) => s !== stage) : [...open, stage];
    setOpen(next);
    remember(PIPELINE_OPEN_COOKIE, next.join(","));
  };
  const pickPhone = (stage: string) => { setPhone(stage); remember(PIPELINE_STAGE_COOKIE, stage); };

  /** Move a project: `position` null puts it on top of that stage. */
  const move = async (o: Opportunity, stage: string, position: number | null, say?: string) => {
    if (moves.current.get(o.id)?.pending) return;
    const before = itemsRef.current.find((x) => x.id === o.id);
    if (!before) return;
    const col = inStage(itemsRef.current, stage).filter((x) => x.id !== o.id);
    const nextPosition = position ?? (col[0] ? col[0].position - 1 : 0);
    const change = { stage, position: nextPosition, pending: true,
      beforeId: col.filter((x) => x.position < nextPosition).at(-1)?.id,
      afterId: col.find((x) => x.position > nextPosition)?.id };
    moves.current.set(o.id, change);
    setPending((old) => new Set(old).add(o.id));
    // Update the listener's source synchronously, before another card can move.
    itemsRef.current = itemsRef.current.map((x) => x.id === o.id ? { ...x, stage, position: nextPosition } : x);
    setItems(itemsRef.current);
    const result = await run("opportunity.move", { id: o.id, stage, position }, say);
    if (result.ok) {
      change.pending = false;
      // A refresh may already have arrived before the save promise resumed.
      const next = mergeMoves(source.current, moves.current);
      itemsRef.current = next;
      setItems(next);
    } else {
      moves.current.delete(o.id);
      setItems((current) => {
        const next = current.map((x) => x.id === o.id ? { ...x, stage: before.stage, position: before.position } : x);
        itemsRef.current = next;
        return next;
      });
    }
    setPending((old) => { const next = new Set(old); next.delete(o.id); return next; });
  };
  useEffect(() => { itemsRef.current = items; moveRef.current = move; });
  const moveTo = (o: Opportunity, stage: string) => { if (stage !== o.stage) void move(o, stage, null, "Moved to " + stageLabel(OPP_STAGES, stage)); };

  // The phone's stage tabs keep the picked one in view.
  useEffect(() => {
    const t = tabs.current, on = t?.querySelector<HTMLElement>("[aria-selected=true]");
    if (t && on) t.scrollLeft = on.offsetLeft - t.clientWidth / 2 + on.offsetWidth / 2;
  }, [phone, view]);

  // Cards that change place glide there (not with reduced motion).
  useLayoutEffect(() => {
    const b = board.current;
    if (!b) { places.current.clear(); return; }
    const br = b.getBoundingClientRect(), calm = matchMedia("(prefers-reduced-motion: reduce)").matches, next = new Map<number, { x: number; y: number }>();
    b.querySelectorAll<HTMLElement>(".pipe-card[data-id]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const id = Number(el.dataset.id), at = { x: r.left - br.left + b.scrollLeft, y: r.top - br.top }, was = places.current.get(id);
      next.set(id, at);
      if (!calm && was && Math.hypot(was.x - at.x, was.y - at.y) > 1) el.animate([{ transform: `translate(${was.x - at.x}px, ${was.y - at.y}px)` }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
    places.current = next;
  });

  // Drag and drop. Past a few pixels the card lifts, a gap shows where it will land, and the board scrolls when the
  // pointer nears an edge. A finger holds still a moment first (the card lifts to say so); moving sooner is a scroll.
  useEffect(() => {
    let frame = 0;
    const target = () => {
      const l = live.current, b = board.current;
      if (!l || !b) return;
      let stage: string | undefined, index: number | null = null;
      const tab = document.elementFromPoint(l.x, l.y)?.closest<HTMLElement>("[data-drop]");
      if (tab) stage = tab.dataset.drop;
      else {
        const col = [...b.querySelectorAll<HTMLElement>("[data-stage]")].find((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && l.x >= r.left && l.x <= r.right; });
        if (!col) return;
        stage = col.dataset.stage!;
        if (!col.hasAttribute("data-collapsed")) index = [...col.querySelectorAll<HTMLElement>(".pipe-card[data-id]")].filter((c) => c.dataset.id !== String(l.id) && c.offsetHeight && c.getBoundingClientRect().top + c.offsetHeight / 2 < l.y).length;
      }
      if (!stage) return;
      l.stage = stage; l.index = index;
      setDrag((d) => (d && (d.stage !== stage || d.index !== index) ? { ...d, stage: stage!, index } : d));
    };
    const tick = () => {
      const l = live.current, b = board.current;
      if (!l?.on || !b) return;
      const r = b.getBoundingClientRect();
      const sx = l.x < r.left + 60 ? -14 : l.x > r.right - 60 ? 14 : 0, sy = l.y < 90 ? -12 : l.y > innerHeight - 90 ? 12 : 0;
      if (sx) b.scrollLeft += sx;
      if (sy) scrollBy(0, sy);
      if (sx || sy) target();
      frame = requestAnimationFrame(tick);
    };
    const reset = () => {
      const l = live.current;
      live.current = null;
      if (l) { clearTimeout(l.timer); l.el.classList.remove("is-lifting"); }
    };
    const end = () => { reset(); cancelAnimationFrame(frame); document.body.classList.remove("pipe-dragging"); setDrag(null); };
    const pmove = (e: PointerEvent) => {
      const l = live.current;
      if (!l) return;
      l.x = e.clientX; l.y = e.clientY;
      if (!l.on) {
        const far = Math.hypot(l.x - l.sx, l.y - l.sy);
        if (!l.armed) { if (far > 8) reset(); return; }
        if (far < 6) return;
        // A long press that opened the record menu isn't a drag.
        if (document.querySelector(".ctx-menu")) { reset(); return; }
        l.on = true;
        l.el.classList.remove("is-lifting");
        // Tell the record menu's long press this finger is dragging, not pressing.
        document.dispatchEvent(new PointerEvent("pointercancel", { pointerType: "touch" }));
        const o = itemsRef.current.find((x) => x.id === l.id)!;
        l.stage = o.stage; l.index = inStage(itemsRef.current, o.stage).findIndex((x) => x.id === o.id);
        document.body.classList.add("pipe-dragging");
        setDrag({ id: l.id, w: l.w, h: l.h, x: l.x - l.dx, y: l.y - l.dy, stage: l.stage, index: l.index });
        frame = requestAnimationFrame(tick);
      }
      if (ghost.current) ghost.current.style.transform = `translate(${l.x - l.dx}px, ${l.y - l.dy}px) rotate(1.5deg)`;
      target();
    };
    const up = () => {
      const d = live.current;
      if (!d?.on) { reset(); return; }
      // The click that follows a drop isn't an open.
      const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
      addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => removeEventListener("click", stop, { capture: true }), 0);
      const items = itemsRef.current, o = items.find((x) => x.id === d.id)!, col = inStage(items, d.stage).filter((x) => x.id !== d.id);
      const same = o.stage === d.stage && (d.index === null || inStage(items, o.stage).findIndex((x) => x.id === o.id) === d.index);
      // It glides from where it was let go.
      const b = board.current, g = ghost.current?.getBoundingClientRect();
      if (b && g) { const br = b.getBoundingClientRect(); places.current.set(d.id, { x: g.left - br.left + b.scrollLeft, y: g.top - br.top }); }
      end();
      if (same) return;
      // Dropped on a closed column or a phone tab, it goes out of sight: say where it went.
      void moveRef.current(o, d.stage, d.index === null ? null : between(col[d.index - 1], col[d.index]), d.index === null ? "Moved to " + stageLabel(OPP_STAGES, d.stage) : undefined);
    };
    const cancel = (e: Event) => { if (e.isTrusted) end(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && live.current?.on) end(); };
    addEventListener("pointermove", pmove);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", cancel);
    addEventListener("blur", end);
    addEventListener("keydown", key);
    return () => { removeEventListener("pointermove", pmove); removeEventListener("pointerup", up); removeEventListener("pointercancel", cancel); removeEventListener("blur", end); removeEventListener("keydown", key); cancelAnimationFrame(frame); };
  }, []);

  // A finger that has lifted a card drags it instead of scrolling the page.
  useEffect(() => {
    const b = board.current;
    if (!b) return;
    const hold = (e: TouchEvent) => { if (live.current?.armed && e.cancelable) e.preventDefault(); };
    b.addEventListener("touchmove", hold, { passive: false });
    return () => b.removeEventListener("touchmove", hold);
  }, [view]);

  const down = (e: React.PointerEvent<HTMLElement>, o: Opportunity) => {
    const mouse = e.pointerType === "mouse";
    if (moves.current.get(o.id)?.pending || (mouse && e.button !== 0) || !e.isPrimary || (e.target as HTMLElement).closest("select, button, input") || document.body.classList.contains("is-selecting") || document.body.classList.contains("is-space-panning")) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    live.current = { id: o.id, el, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, w: r.width, h: r.height, touch: !mouse, armed: mouse, on: false, stage: o.stage, index: 0 };
    if (!mouse) live.current.timer = setTimeout(() => { const l = live.current; if (l?.id === o.id && !l.on) { l.armed = true; el.classList.add("is-lifting"); } }, 220);
  };

  if (view === "list") return <PipelineList items={items} sort={sort} />;
  const dragged = drag && items.find((o) => o.id === drag.id);
  return (
    <>
      <div className="pipe-tabs" role="tablist" aria-label="Stage" ref={tabs}>
        {OPP_STAGES.map(([s, l]) => {
          const n = items.filter((o) => o.stage === s).length;
          return <button key={s} type="button" role="tab" data-drop={s} aria-selected={phone === s} className={drag?.stage === s && drag.index === null ? "is-over" : ""} onClick={() => pickPhone(s)}>{l}<span>{n}</span></button>;
        })}
      </div>
      {scrollState.overflow && !narrow && <div className="pipe-scroll-controls" role="group" aria-label="Scroll pipeline stages">
        <button type="button" className="icon-btn" disabled={!scrollState.left} aria-label="Scroll pipeline left" title="Scroll pipeline left" onClick={() => scrollBoard("left")}><Icon name="back" /></button>
        <button type="button" className="icon-btn" disabled={!scrollState.right} aria-label="Scroll pipeline right" title="Scroll pipeline right" onClick={() => scrollBoard("right")}><Icon name="back" /></button>
      </div>}
      <div className={"pipe-board-frame" + (scrollState.left ? " can-scroll-left" : "") + (scrollState.right ? " can-scroll-right" : "")}>
      <div className="pipe-board" ref={board} role="region" aria-label="Pipeline stages" tabIndex={narrow || !scrollState.overflow ? undefined : 0} onKeyDown={(e) => {
        if (!scrollState.overflow || e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey || live.current?.on) return;
        const direction = ({ ArrowLeft: "left", ArrowRight: "right", Home: "start", End: "end" } as const)[e.key as "ArrowLeft" | "ArrowRight" | "Home" | "End"];
        if (direction) { e.preventDefault(); scrollBoard(direction); }
      }}>
        {OPP_STAGES.map(([stage, label]) => {
          const cards = inStage(items, stage), collapsed = isCollapsed(stage), over = drag?.stage === stage;
          const total = <>{cards.length > 0 && <b>{moneyShort(sum(cards))}</b>}</>;
          const cls = "pipe-col" + (CLOSED.includes(stage) ? " is-closed" : "") + (phone === stage ? " is-shown" : "") + (over ? " is-over" : "");
          if (collapsed) return (
            <section key={stage} data-stage={stage} data-collapsed="" className={cls + " is-collapsed"} aria-label={label}>
              <button type="button" className="pipe-col-open" onClick={() => toggle(stage)} aria-expanded="false" aria-label={`Show ${label}: ${counted(cards.length)}${cards.length ? ", " + money(sum(cards)) : ""}`}>
                <Icon name="chevron" /><strong>{label}</strong><span>{cards.length}</span>{total}
              </button>
            </section>
          );
          // Only the stage a phone shows has its cards on the page (so Select all picks only what's in sight).
          const show = !narrow || phone === stage;
          let seen = 0;
          const gap = <div key="gap" className="pipe-gap" style={{ height: drag?.h }} />;
          return (
            <section key={stage} data-stage={stage} className={cls} aria-label={label}>
              <header className="pipe-col-head">
                <strong>{label}</strong><span>{cards.length}</span>{total}
                {CLOSED.includes(stage) && <button type="button" className="icon-btn pipe-col-hide" aria-expanded="true" aria-label={"Hide " + label} title={"Hide " + label} onClick={() => toggle(stage)}><Icon name="chevron" /></button>}
              </header>
              <div className="pipe-cards">
                {show && cards.map((o) => {
                  const hidden = o.id === drag?.id, here = over && !hidden && drag!.index === seen;
                  if (!hidden) seen++;
                  return [here ? gap : null, <ProjectCard key={o.id} o={o} hidden={hidden} pending={pending.has(o.id)} down={down} moveTo={moveTo} />];
                })}
                {over && drag!.index !== null && drag!.index >= seen && gap}
                {show && !cards.length && !over && <div className="pipe-empty"><span>No projects</span><small>Drag one here</small></div>}
              </div>
            </section>
          );
        })}
      </div>
      </div>
      {drag && dragged && <div ref={ghost} className="pipe-ghost" style={{ width: drag.w, transform: `translate(${drag.x}px, ${drag.y}px) rotate(1.5deg)` }}><CardBody o={dragged} /></div>}
    </>
  );
}

function CardBody({ o }: { o: Opportunity }) {
  const f = dueState(o.next_follow_up), late = OPEN_STAGES.includes(o.stage) && !!o.close_date && o.close_date < today();
  return (
    <>
      <strong className="pipe-name">{o.name}</strong>
      {(o.company || o.contact) && <small className="pipe-who">{[o.company, o.contact].filter(Boolean).join(" · ")}</small>}
      {(o.value_cents > 0 || o.close_date || o.next_follow_up) && <span className="pipe-meta">
        {o.value_cents > 0 && <b>{money(o.value_cents)}</b>}
        {o.close_date && <span className={late ? "is-late" : ""}>Closes {dayLabel(o.close_date)}</span>}
        {o.next_follow_up && <span className={f ? "is-" + f : ""}>Follow up {dayLabel(o.next_follow_up)}</span>}
      </span>}
    </>
  );
}

/**
 * One card: a click anywhere opens the project (not after a drag). The ··· menu moves it to another stage (it shows on
 * hover or keyboard focus, and always on a touch screen). The data- attributes give it the app's right-click menu.
 */
function ProjectCard({ o, hidden, pending, down, moveTo }: { o: Opportunity; hidden: boolean; pending: boolean; down: (e: React.PointerEvent<HTMLElement>, o: Opportunity) => void; moveTo: (o: Opportunity, stage: string) => void }) {
  return (
    <div className={"pipe-card tap" + (hidden ? " is-dragged" : "")} data-kind="opportunity" data-id={o.id} data-name={o.name} aria-busy={pending} onPointerDown={(e) => down(e, o)}>
      <Link href={"/pipeline/" + o.id} className="tap-link" aria-label={"Open " + o.name} draggable={false} />
      <CardBody o={o} />
      <span className="pipe-move" title="Move to another stage">
        <StageMenu compact stage={o.stage} disabled={pending} label={"Move " + o.name + " to another stage"} onChange={(stage) => moveTo(o, stage)} />
      </span>
    </div>
  );
}

const byDate = (a: string | null, b: string | null) => (a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0);
const SORTS: Record<string, (a: Opportunity, b: Opportunity) => number> = {
  value: (a, b) => b.value_cents - a.value_cents,
  close: (a, b) => byDate(a.close_date, b.close_date),
  follow_up: (a, b) => byDate(a.next_follow_up, b.next_follow_up),
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  name: () => 0,
};
/** A column heading that sorts the list by it. */
const HEADS: [string, string][] = [["name", "Project"], ["value", "Value"], ["close", "Close date"], ["follow_up", "Next follow-up"]];

/** The list: a group per stage (open ones first, the board's order), or one list in the picked sort. Each row opens its project. */
function PipelineList({ items, sort }: { items: Opportunity[]; sort: string }) {
  const setSort = useSetSort();
  const head = (
    <div className="row row-head pipe-row-head">
      {HEADS.map(([k, l]) => <button key={k} type="button" className={sort === k ? "is-on" : ""} aria-pressed={sort === k} onClick={() => setSort(sort === k ? "stage" : k)}>{l}</button>)}
    </div>
  );
  const rows = (list: Opportunity[], withStage: boolean) => list.map((o) => {
    const f = dueState(o.next_follow_up), late = OPEN_STAGES.includes(o.stage) && !!o.close_date && o.close_date < today();
    const sub = [withStage ? stageLabel(OPP_STAGES, o.stage) : "", o.company, o.contact].filter(Boolean).join(" · ");
    return (
      <Link key={o.id} href={"/pipeline/" + o.id} className={"row" + (withStage && CLOSED.includes(o.stage) ? " is-closed" : "")} data-kind="opportunity" data-id={o.id} data-name={o.name} data-href={"/pipeline/" + o.id}>
        <span className="who"><span style={{ minWidth: 0 }}><strong>{o.name}</strong><small>{sub || "No company yet"}</small></span></span>
        <span className="cell">{o.value_cents ? money(o.value_cents) : <span className="muted">—</span>}</span>
        <span className={"cell" + (late ? " is-late" : "")}>{dayLabel(o.close_date) || <span className="muted">—</span>}</span>
        <span className={"cell" + (f ? " is-" + f : "")}>{dayLabel(o.next_follow_up) || <span className="muted">—</span>}</span>
      </Link>
    );
  });
  if (sort !== "stage") {
    const by = SORTS[sort] ?? SORTS.name;
    const list = [...items].sort((a, b) => by(a, b) || a.name.localeCompare(b.name));
    return <div className="rows">{head}{rows(list, true)}</div>;
  }
  return (
    <>
      {OPP_STAGES.map(([stage, label]) => {
        const list = inStage(items, stage);
        if (!list.length) return null;
        return (
          <section key={stage} className={"pipe-group" + (CLOSED.includes(stage) ? " is-closed" : "")}>
            <div className="section-title"><h2>{label}</h2><small>{counted(list.length)} · {money(sum(list))}</small></div>
            <div className="rows">{head}{rows(list, false)}</div>
          </section>
        );
      })}
    </>
  );
}

