import Link from "next/link";
import { session } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { MAIN, SALES, WORKSPACE, type Area } from "@/components/areas";

export const metadata = { title: "More · Rolodex" };

// The phone's More tab: every area the bottom bar has no room for, plus your account and Sign out.
const ROW = { gridTemplateColumns: "minmax(0,1fr) auto" };

function AreaRow({ a }: { a: Area }) {
  return (
    <Link href={a.href} className="row" style={ROW}>
      <span className={"who" + (a.soon ? " muted" : "")}><span className="avatar"><Icon name={a.icon} /></span><strong style={{ fontWeight: 500 }}>{a.label}</strong></span>
      {a.soon ? <span className="pill">Soon</span> : <span className="muted" style={{ display: "grid", width: 18, transform: "rotate(-90deg)" }}><Icon name="chevron" /></span>}
    </Link>
  );
}

export default async function MorePage() {
  const s = await session();
  return (
    <>
      <div className="page-head"><div><h1>More</h1></div></div>
      <div className="rows">{MAIN.filter((a) => !["/dashboard", "/contacts", "/companies", "/todos"].includes(a.href)).map((a) => <AreaRow key={a.href} a={a} />)}</div>
      <div className="section-title"><h2>Sales</h2></div>
      <div className="rows">{SALES.map((a) => <AreaRow key={a.href} a={a} />)}</div>
      <div className="section-title"><h2>Workspace</h2></div>
      <div className="rows">{WORKSPACE.map((a) => <AreaRow key={a.href} a={a} />)}</div>
      <div className="section-title"><h2>Account</h2></div>
      <div className="rows">
        <Link href="/account" className="row" style={ROW}>
          <span className="who"><span className="avatar"><Icon name="user" /></span><span style={{ minWidth: 0 }}><strong style={{ fontWeight: 500 }}>My account</strong>{s && <small>{s.user.name} · {s.user.email}</small>}</span></span>
          <span className="muted" style={{ display: "grid", width: 18, transform: "rotate(-90deg)" }}><Icon name="chevron" /></span>
        </Link>
        {/* A plain form post, like the account page's Sign out. */}
        <form action="/api/logout" method="post" className="row" style={ROW}>
          <button type="submit" className="link" style={{ width: "100%", textAlign: "left", color: "var(--bad)", fontSize: 15 }}>Sign out</button>
        </form>
      </div>
    </>
  );
}
