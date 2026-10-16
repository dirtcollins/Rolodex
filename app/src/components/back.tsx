"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "./icons";

// Contextual back (Brendan 10-15): a record's back button returns to the page you came from (the company you were on,
// the search or filtered list, at the same scroll), not a fixed list. NavTrail remembers the path you took in this tab;
// BackLink goes back along it, and falls back to the list when you arrived from outside (a bookmark, a new tab).

type Step = { url: string; label: string; y?: number };
const KEY = "rx-trail";
const pathOf = (url: string) => url.split(/[?#]/)[0];
const read = (): Step[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const write = (t: Step[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(t.slice(-50))); } catch { /* private mode */ } };
/** What a page is called: a record's name, else the page's name from its tab title ("Dashboard", not its greeting). */
const labelNow = () => document.querySelector("main [data-self] h1")?.textContent?.trim()
  || document.title.replace(/^\(\d+\)\s*/, "").replace(/\s*·\s*(Rolodex|Collins Creative).*$/, "").trim();

/** Mounted once in the shell. Going back pops a step; a new filter or sort on the same page replaces it. */
export function NavTrail() {
  const path = usePathname(), search = useSearchParams().toString();
  const [hash, setHash] = useState("");
  useEffect(() => { const sync = () => setHash(location.hash); sync(); addEventListener("hashchange", sync); addEventListener("popstate", sync); return () => { removeEventListener("hashchange", sync); removeEventListener("popstate", sync); }; }, []);
  useScrollMemory();
  useEffect(() => {
    const url = path + (search ? "?" + search : "") + location.hash;
    const t = read();
    const same = !!t.at(-1) && pathOf(t.at(-1)!.url) === path;
    const back = !same && !!t.at(-2) && pathOf(t.at(-2)!.url) === path;
    if (back) t.pop();
    else if (same) t[t.length - 1] = { ...t.at(-1)!, url };
    else t.push({ url, label: "" });
    write(t);
    // Back to a page: the same spot on it, once it's tall enough to get there.
    const y = back ? t.at(-1)?.y ?? 0 : 0;
    let observer: MutationObserver | undefined, timer: ReturnType<typeof setTimeout> | undefined, frame = 0;
    const stop = () => { observer?.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame); };
    if (y) {
      const restore = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          scrollTo(0, y);
          if (Math.abs(scrollY - y) < 2 && !document.querySelector('[data-directory-restoring="true"]')) stop();
        });
      };
      // Incremental directories can need several batches before the old scroll position exists.
      observer = new MutationObserver(restore);
      observer.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-directory-restoring"] });
      timer = setTimeout(stop, 15000);
      restore();
    }
    addEventListener("wheel", stop, { passive: true, once: true });
    addEventListener("touchstart", stop, { passive: true, once: true });
    // The heading is on screen once the page has painted.
    const id = requestAnimationFrame(() => { const now = read(); if (now.at(-1)?.url === url) { now[now.length - 1].label = labelNow(); write(now); } });
    return () => { cancelAnimationFrame(id); stop(); removeEventListener("wheel", stop); removeEventListener("touchstart", stop); };
  }, [path, search, hash]);
  return null;
}

/** Where you are on each page, so Back can return there. */
function useScrollMemory() {
  useEffect(() => {
    let frame = 0;
    const note = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const t = read(), here = location.pathname + location.search + location.hash;
        if (t.at(-1)?.url === here) { t[t.length - 1].y = Math.round(scrollY); write(t); }
      });
    };
    addEventListener("scroll", note, { passive: true });
    return () => { removeEventListener("scroll", note); cancelAnimationFrame(frame); };
  }, []);
}

/** The back button on a record's page: "‹ Freestyle Event Services" when you came from there, else the list. */
export function BackLink({ href, label }: { href: string; label: string }) {
  const path = usePathname();
  const [from, setFrom] = useState<Step | null>(null);
  useEffect(() => {
    // After NavTrail has noted this page: the step before it is where you came from.
    const id = requestAnimationFrame(() => { const t = read(); setFrom(t.at(-1) && pathOf(t.at(-1)!.url) === path && t.length > 1 ? t.at(-2)! : null); });
    return () => cancelAnimationFrame(id);
  }, [path]);
  if (!from) return <Link className="back" href={href}><Icon name="back" />{label}</Link>;
  return (
    <Link className="back" href={from.url} scroll={false}>
      <Icon name="back" />{from.label || label}
    </Link>
  );
}
