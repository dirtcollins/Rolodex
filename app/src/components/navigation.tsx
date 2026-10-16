"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Trip = { from: string; to: string; started: number; feedbackMs?: number };
type Sample = { from: string; to: string; feedbackMs: number; viewMs: number };

/** Keep navigation in the existing shell; warm only links the person shows interest in. */
export function Navigation() {
  const router = useRouter(), path = usePathname(), search = useSearchParams().toString();
  const route = path + (search ? "?" + search : "");
  const [pending, setPending] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null), trip = useRef<Trip | null>(null);
  const samples = useRef<Sample[]>([]), prefetched = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    if (pending && trip.current && trip.current.feedbackMs === undefined) {
      trip.current.feedbackMs = Math.round((performance.now() - trip.current.started) * 10) / 10;
    }
  }, [pending]);

  useEffect(() => {
    const node = host.current;
    if (node) { node.dataset.shellInstance ||= crypto.randomUUID(); node.dataset.documentStart = String(performance.timeOrigin); }
    let hover: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const internal = (target: EventTarget | null) => {
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.closest('[data-selecting="true"]')) return null;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || /\/(api|login)(\/|$)/.test(url.pathname)) return null;
      if (url.pathname + url.search === location.pathname + location.search) return null;
      return url.pathname + url.search;
    };
    const warm = (href: string) => {
      const now = Date.now();
      if (now - (prefetched.current.get(href) ?? 0) < 30000) return;
      prefetched.current.set(href, now);
      if (prefetched.current.size > 40) prefetched.current.delete(prefetched.current.keys().next().value!);
      router.prefetch(href);
    };
    const over = (e: PointerEvent) => { clearTimeout(hover); const href = internal(e.target); if (href) hover = setTimeout(() => warm(href), 80); };
    const focus = (e: FocusEvent) => { const href = internal(e.target); if (href) warm(href); };
    const out = () => clearTimeout(hover);
    const begin = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = internal(e.target);
      if (!href) return;
      trip.current = { from: location.pathname + location.search, to: href, started: performance.now() };
      setPending(href);
      window.dispatchEvent(new CustomEvent("rx-navigation", { detail: href }));
      clearTimeout(watchdog);
      watchdog = setTimeout(() => { trip.current = null; setPending(null); window.dispatchEvent(new CustomEvent("rx-navigation", { detail: null })); }, 15000);
    };
    const saved = () => prefetched.current.clear();
    document.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("pointerout", out, { passive: true });
    document.addEventListener("focusin", focus);
    document.addEventListener("click", begin, true);
    window.addEventListener("rx-saved", saved);
    return () => {
      clearTimeout(hover); clearTimeout(watchdog);
      document.removeEventListener("pointerover", over); document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focus); document.removeEventListener("click", begin, true);
      window.removeEventListener("rx-saved", saved);
    };
  }, [router]);

  useEffect(() => {
    if (!trip.current || trip.current.to !== route) return;
    const finish = () => {
      if (!trip.current || document.querySelector("main .loading-page")) return;
      const sample = { from: trip.current.from, to: trip.current.to, feedbackMs: trip.current.feedbackMs ?? 0, viewMs: Math.round((performance.now() - trip.current.started) * 10) / 10 };
      samples.current = [...samples.current.slice(-19), sample];
      if (host.current) host.current.dataset.navigationSamples = JSON.stringify(samples.current);
      trip.current = null;
      setPending(null);
      window.dispatchEvent(new CustomEvent("rx-navigation", { detail: null }));
    };
    finish();
    const observer = new MutationObserver(finish);
    const main = document.querySelector("main");
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [route]);

  return <div ref={host} className="navigation-feedback" data-pending={pending ? "true" : "false"}>
    {pending && <><span className="navigation-line" aria-hidden="true" /><span className="sr-only" role="status">Opening view…</span></>}
  </div>;
}
