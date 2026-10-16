"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { MAIN, SALES, WORKSPACE, PHONE_BAR, areaFor, inArea, type Area } from "./areas";

type Counts = Partial<Record<NonNullable<Area["count"]>, number>>;

/** Highlight the destination on the click, then let the committed route take over. */
function useActivePath() {
  const path = usePathname(), [destination, setDestination] = useState<string | null>(null);
  useEffect(() => {
    const pending = (event: Event) => setDestination((event as CustomEvent<string | null>).detail?.split(/[?#]/)[0] ?? null);
    addEventListener("rx-navigation", pending);
    return () => removeEventListener("rx-navigation", pending);
  }, []);
  useEffect(() => { setDestination(null); }, [path]);
  return destination ?? path;
}

function Item({ a, path, counts }: { a: Area; path: string; counts: Counts }) {
  const n = a.count ? counts[a.count] : undefined;
  const countTone = a.count === "followups" ? " is-due" : a.count === "todos" ? " is-task" : " is-total";
  return (
    <Link href={a.href} className={"nav-item" + (inArea(path, a) ? " active" : "") + (a.soon ? " is-soon" : "")} aria-current={inArea(path, a) ? "page" : undefined}>
      <Icon name={a.href === "/contacts" ? "person" : a.href === "/companies" ? "buildings" : a.href === "/settings" ? "sliders" : a.icon} /><span className="nav-label">{a.label}</span>
      {a.soon ? <span className="nav-count">Soon</span> : typeof n === "number" ? <span className={"nav-count" + countTone}>{n.toLocaleString()}</span> : null}
    </Link>
  );
}

export function SideNav({ counts }: { counts: Counts }) {
  const path = useActivePath();
  return (
    <nav className="nav" aria-label="Rolodex">
      {MAIN.map((a) => <Item key={a.href} a={a} path={path} counts={counts} />)}
      <div className="nav-group">Sales</div>
      {SALES.map((a) => <Item key={a.href} a={a} path={path} counts={counts} />)}
      <div className="nav-group">Workspace</div>
      {WORKSPACE.map((a) => <Item key={a.href} a={a} path={path} counts={counts} />)}
    </nav>
  );
}

export function PageName() {
  return <>{areaFor(usePathname())?.label ?? "Rolodex"}</>;
}

export function MobileNav() {
  const path = useActivePath();
  const bar = [...PHONE_BAR.map((h) => MAIN.find((a) => a.href === h)!), { href: "/more", label: "More", icon: "more" }];
  const inBar = bar.some((a) => a.href !== "/more" && inArea(path, a));
  return (
    <nav className="mobile-nav" aria-label="Rolodex">
      {bar.map((a) => {
        const on = a.href === "/more" ? !inBar : inArea(path, a);
        return <Link key={a.href} href={a.href} className={on ? "active" : ""} aria-current={on ? "page" : undefined}><Icon name={a.icon} />{a.label}</Link>;
      })}
    </nav>
  );
}
