"use client";
import { useEffect } from "react";
import "./space-pan.css";

const TYPING = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]';
const KEYBOARD_CONTROL = 'button,summary,[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"],[role="spinbutton"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="tab"]';

type Gesture = { pointerId: number; target: HTMLElement; vertical: HTMLElement | null; x: number; y: number;
  lastX: number; lastY: number; left: number; top: number; moved: boolean };

export function panOffset(start: number, down: number, current: number, maximum: number) {
  return Math.max(0, Math.min(Math.max(0, maximum), start + down - current));
}

/** Native-feeling Space + drag panning. Ordinary clicks, card drag, typing and wheel scrolling stay native. */
export function SpacePan() {
  useEffect(() => {
    let held = false, ready: HTMLElement | null = null, gesture: Gesture | null = null, frame = 0;
    let pointer = { x: -1, y: -1 }, suppressClickUntil = 0;
    const downPointers = new Set<number>();
    const targetElement = (target: EventTarget | null) => target instanceof Element ? target : null;
    const cardDragging = () => document.body.classList.contains("pipe-dragging") || !!document.querySelector(".pipe-card.is-lifting");
    const eligible = (element: Element | null) => {
      if (!element || element.closest(TYPING)) return null;
      for (let node: HTMLElement | null = element instanceof HTMLElement ? element : element.parentElement; node && node !== document.body; node = node.parentElement) {
        if (node.matches(".pipe-board")) return node; // Hand-tool feedback is useful even when all stages currently fit.
        if (node.scrollWidth > node.clientWidth + 1 && /^(auto|scroll)$/.test(getComputedStyle(node).overflowX)) return node;
      }
      return null;
    };
    const setReady = (next: HTMLElement | null) => {
      if (ready !== next) { ready?.classList.remove("space-pan-ready"); ready = next; ready?.classList.add("space-pan-ready"); }
      document.body.classList.toggle("is-space-panning", !!ready);
    };
    const atPointer = () => pointer.x >= 0 ? document.elementFromPoint(pointer.x, pointer.y) : null;
    const refreshReady = () => setReady(held && !cardDragging() && !downPointers.size ? eligible(atPointer()) : null);
    const verticalOwner = (target: HTMLElement) => {
      for (let node: HTMLElement | null = target; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight + 1 && /^(auto|scroll)$/.test(getComputedStyle(node).overflowY)) return node;
      }
      if (getComputedStyle(document.documentElement).overflowY === "hidden" || getComputedStyle(document.body).overflowY === "hidden") return null;
      return document.scrollingElement as HTMLElement | null;
    };
    const flush = () => {
      frame = 0;
      if (!gesture) return;
      const g = gesture;
      g.target.scrollLeft = panOffset(g.left, g.x, g.lastX, g.target.scrollWidth - g.target.clientWidth);
      if (g.vertical) g.vertical.scrollTop = panOffset(g.top, g.y, g.lastY, g.vertical.scrollHeight - g.vertical.clientHeight);
    };
    const finishGesture = (suppress = true) => {
      if (frame) { cancelAnimationFrame(frame); frame = 0; flush(); }
      const g = gesture;
      gesture = null;
      document.body.classList.remove("is-space-dragging");
      if (g) {
        // Even a stationary hand-tool press must not accidentally open the record underneath it.
        if (suppress) suppressClickUntil = performance.now() + 450;
        g.target.classList.remove("space-pan-scrolling"); g.vertical?.classList.remove("space-pan-scrolling");
        try { if (g.target.hasPointerCapture(g.pointerId)) g.target.releasePointerCapture(g.pointerId); } catch { /* The browser may already have released it. */ }
      }
    };
    const reset = () => { held = false; finishGesture(); setReady(null); };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      const target = targetElement(event.target);
      if (target?.closest(TYPING + "," + KEYBOARD_CONTROL)) return;
      if (held) { event.preventDefault(); return; }
      if (event.repeat || downPointers.size || cardDragging()) return;
      const area = eligible(atPointer());
      if (!area) return;
      event.preventDefault(); held = true; setReady(area);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" || !held) return;
      event.preventDefault(); reset();
    };
    const pointerDown = (event: PointerEvent) => {
      suppressClickUntil = 0; // A fresh ordinary click must never inherit a previous pan’s suppression.
      const alreadyDown = downPointers.size > 0;
      downPointers.add(event.pointerId);
      pointer = { x: event.clientX, y: event.clientY };
      if (!held || alreadyDown || event.button !== 0 || !event.isPrimary || cardDragging()) { if (!gesture) setReady(null); return; }
      const area = eligible(targetElement(event.target));
      if (!area) { setReady(null); return; }
      // The hand tool is navigation, never an activation. Remove focus from a prior card or
      // board before the drag starts so it cannot leave a focus ring behind afterwards.
      const active = document.activeElement;
      if (active instanceof HTMLElement && !active.matches(TYPING)) active.blur();
      setReady(area);
      const vertical = verticalOwner(area);
      gesture = { pointerId: event.pointerId, target: area, vertical, x: event.clientX, y: event.clientY,
        lastX: event.clientX, lastY: event.clientY, left: area.scrollLeft, top: vertical?.scrollTop ?? 0, moved: false };
      area.classList.add("space-pan-scrolling"); vertical?.classList.add("space-pan-scrolling");
      document.body.classList.add("is-space-dragging");
      try { area.setPointerCapture(event.pointerId); } catch { /* Document listeners also cover capture-unavailable environments. */ }
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const pointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!gesture || gesture.pointerId !== event.pointerId) { if (!gesture) refreshReady(); return; }
      gesture.lastX = event.clientX; gesture.lastY = event.clientY;
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 3) gesture.moved = true;
      if (!frame) frame = requestAnimationFrame(flush);
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const pointerEnd = (event: PointerEvent) => {
      downPointers.delete(event.pointerId);
      pointer = { x: event.clientX, y: event.clientY };
      if (gesture?.pointerId === event.pointerId) {
        event.preventDefault(); event.stopImmediatePropagation(); finishGesture();
      }
      if (event.type === "pointercancel") { held = false; setReady(null); }
      else refreshReady();
    };
    const click = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil && event.detail > 0) {
        suppressClickUntil = 0; event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    const blur = () => { downPointers.clear(); reset(); pointer = { x: -1, y: -1 }; };
    const visibility = () => { if (document.hidden) blur(); };
    const focusChanged = () => { if (held || gesture) reset(); };
    const lostCapture = (event: PointerEvent) => { if (gesture?.pointerId === event.pointerId) { downPointers.delete(event.pointerId); reset(); } };
    const leave = (event: MouseEvent) => { if (!event.relatedTarget && !gesture) setReady(null); };
    const scrollOrResize = () => { if (held && !gesture) refreshReady(); };
    document.addEventListener("keydown", keyDown, true);
    document.addEventListener("keyup", keyUp, true);
    document.addEventListener("pointerdown", pointerDown, { capture: true, passive: false });
    document.addEventListener("pointermove", pointerMove, { capture: true, passive: false });
    document.addEventListener("pointerup", pointerEnd, true);
    document.addEventListener("pointercancel", pointerEnd, true);
    document.addEventListener("lostpointercapture", lostCapture, true);
    window.addEventListener("click", click, true);
    document.addEventListener("focusin", focusChanged, true);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("mouseout", leave);
    document.addEventListener("scroll", scrollOrResize, true);
    window.addEventListener("resize", scrollOrResize);
    window.addEventListener("blur", blur);
    return () => {
      blur();
      document.removeEventListener("keydown", keyDown, true);
      document.removeEventListener("keyup", keyUp, true);
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointermove", pointerMove, true);
      document.removeEventListener("pointerup", pointerEnd, true);
      document.removeEventListener("pointercancel", pointerEnd, true);
      document.removeEventListener("lostpointercapture", lostCapture, true);
      window.removeEventListener("click", click, true);
      document.removeEventListener("focusin", focusChanged, true);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("mouseout", leave);
      document.removeEventListener("scroll", scrollOrResize, true);
      window.removeEventListener("resize", scrollOrResize);
      window.removeEventListener("blur", blur);
    };
  }, []);
  return null;
}
