import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { one } from "@/lib/db";
import { FOLLOWUPS_DUE_SQL } from "@/lib/data";
import { Icon } from "./icons";
import { Wordmark } from "./wordmark";
import { SideNav, PageName, MobileNav } from "./nav";
import { Search } from "./search";
import { Bell } from "./bell";
import { Toasts } from "./ui";
import { OpenPickers } from "./open-pickers";
import { RecordMenu } from "./record-menu";
import { NavTrail } from "./back";
import { Navigation } from "./navigation";
import { SpacePan } from "./space-pan";
import { LogReachPrompt } from "./reach";
import { UserAvatar } from "./user-avatar";
import { Suspense } from "react";

// The frame around every screen (Light Ops' shell): sidebar, top bar with search, phone bars, toasts.
export async function Shell({ children }: { children: React.ReactNode }) {
  const s = await session();
  if (!s) {
    const requestPath = (await headers()).get("x-rolodex-path") ?? "/";
    if (!requestPath.startsWith("/login")) redirect("/login" + (requestPath === "/" ? "" : "?next=" + encodeURIComponent(requestPath)));
    return <>{children}<Toasts /></>;
  }
  const counts = (await one<{ contacts: number; companies: number; todos: number; deals: number; followups: number }>(`select
    (select count(*)::int from contacts where deleted_at is null) as contacts,
    (select count(*)::int from companies where deleted_at is null) as companies,
    (select count(*)::int from todos where deleted_at is null and done_at is null) as todos,
    (select count(*)::int from opportunities where deleted_at is null and stage in ('lead','meeting','proposal_sent','negotiating')) as deals,
    ${FOLLOWUPS_DUE_SQL} as followups`))!;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="side-brand" aria-label="Rolodex home"><Wordmark horizontal /></Link>
        <div className="side-search"><Search sidebar /></div>
        <SideNav counts={counts} />
        <div className="side-foot">
          <Link href="/account" className="side-user"><UserAvatar name={s.user.name} /><span className="side-user-copy"><strong>{s.user.name}</strong><small>Collins Creative</small></span><span className="side-user-chevron"><Icon name="back" /></span></Link>
        </div>
      </aside>
      <div className="main">
        <header className="topbar"><span className="crumb">Rolodex<i>/</i><b><PageName /></b></span><Bell /></header>
        <header className="mobile-top"><Wordmark small /><strong><PageName /></strong><Search phone /><Bell phone /></header>
        <a className="skip-link" href="#main-content">Skip to content</a><main className="page" id="main-content"><div id="selection-controls" />{children}</main>
      </div>
      <MobileNav />
      <Toasts />
      <OpenPickers />
      <RecordMenu />
      <SpacePan />
      <LogReachPrompt />
      <Suspense><NavTrail /><Navigation /></Suspense>
    </div>
  );
}
