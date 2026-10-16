"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { computeMenuPosition, type MenuPosition } from "./menu-position";
import "./anchored-menu.css";
export { computeMenuPosition } from "./menu-position";

type Props = { anchor: HTMLElement | null; onClose: () => void; children: ReactNode; className?: string;
  matchWidth?: boolean; minWidth?: number; role?: "menu" | "listbox"; id?: string; ariaLabel?: string; point?: { x: number; y: number } };

/** One positioning model for input suggestions, action menus and pointer context menus. */
export function AnchoredMenu({ anchor, onClose, children, className = "", matchWidth = true, minWidth = 0, role, id, ariaLabel, point }: Props) {
  const menu = useRef<HTMLDivElement>(null), close = useRef(onClose), previousFocus = useRef<HTMLElement | null>(null);
  const reposition = useRef<() => void>(() => {}), focused = useRef(false);
  const [host, setHost] = useState<HTMLElement | null>(null), [position, setPosition] = useState<MenuPosition | null>(null);
  close.current = onClose;
  useLayoutEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    focused.current = false;
    setPosition(null);
    setHost(anchor?.closest<HTMLDialogElement>("dialog[open]") ?? (point ? [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].at(-1) : null) ?? document.body);
  }, [anchor, point?.x, point?.y]);

  useLayoutEffect(() => {
    const node = menu.current;
    if (!host || !node || (!anchor && !point)) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (anchor && !anchor.isConnected) { close.current(); return; }
      const vv = window.visualViewport;
      const viewport = { left: vv?.offsetLeft ?? 0, top: vv?.offsetTop ?? 0, width: vv?.width ?? window.innerWidth, height: vv?.height ?? window.innerHeight };
      const rect = point ? { left: point.x, right: point.x, top: point.y, bottom: point.y, width: 0 } : anchor!.getBoundingClientRect();
      if (!point && (rect.bottom < viewport.top || rect.top > viewport.top + viewport.height)) { close.current(); return; }
      if (anchor && !point) {
        // Once the field scrolls completely out of its own form, its menu should leave with it.
        for (let parent = anchor.parentElement; parent && parent !== host; parent = parent.parentElement) {
          const style = getComputedStyle(parent), clip = parent.getBoundingClientRect();
          if ((/(auto|scroll|hidden|clip)/.test(style.overflowY) && (rect.bottom <= clip.top || rect.top >= clip.bottom)) ||
              (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (rect.right <= clip.left || rect.left >= clip.right))) {
            close.current(); return;
          }
        }
      }
      const bounds = node.getBoundingClientRect();
      const next = computeMenuPosition(rect, { width: Math.max(bounds.width, node.scrollWidth + 2), height: node.scrollHeight + 2 }, viewport,
        { matchWidth: point ? false : matchWidth, minWidth });
      setPosition(old => old && Object.keys(next).every(key => old[key as keyof MenuPosition] === next[key as keyof MenuPosition]) ? old : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    reposition.current = schedule;
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (anchor) observer?.observe(anchor);
    observer?.observe(node);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!node.contains(target) && !anchor?.contains(target)) close.current();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); close.current();
        const focus = anchor ?? previousFocus.current;
        if (focus?.isConnected) focus.focus({ preventScroll: true });
      } else if (role === "menu" && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        const items = [...node.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]):not([aria-disabled="true"]),button:not([disabled]):not([aria-disabled="true"])')].filter(item => item.getClientRects().length > 0);
        if (!items.length) return;
        event.preventDefault(); event.stopPropagation();
        const at = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (at + 1) % items.length : at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length;
        items[next].focus({ preventScroll: true });
        items[next].scrollIntoView({ block: "nearest" });
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", keys, true);
    return () => {
      reposition.current = () => {};
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", keys, true);
    };
  }, [host, anchor, point?.x, point?.y, matchWidth, minWidth, role]);

  useLayoutEffect(() => {
    if (position && role === "menu" && !focused.current) {
      focused.current = true;
      menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled]):not([aria-disabled="true"]),button:not([disabled]):not([aria-disabled="true"])')?.focus({ preventScroll: true });
    }
  }, [position, role]);

  // Lists can change without their visible outer size changing (for example after typing a query).
  useLayoutEffect(() => { reposition.current(); }, [children]);
  if (!host || (!anchor && !point)) return null;
  return createPortal(<div ref={menu} id={id} role={role} aria-label={ariaLabel} className={"anchored-menu " + className}
    data-placement={position?.placement} style={{ left: position?.left ?? 0, top: position?.top ?? 0,
      width: position?.width ?? (matchWidth && anchor && !point ? anchor.getBoundingClientRect().width : undefined),
      maxWidth: "calc(100vw - 16px)", maxHeight: position?.maxHeight ?? 320, visibility: position ? "visible" : "hidden" }}
    onClickCapture={event => {
      if ((event.target as Element).closest('[role="option"]'))
        (anchor ?? host).dispatchEvent(new CustomEvent("rx-draft-change", { bubbles: true }));
    }}>{children}</div>, host);
}
