import { redirect } from "next/navigation";
import { MIN_PASSWORD, ROLE_LABELS, session } from "@/lib/auth";
import { AccountForm } from "@/components/account-parts";
import { UserAvatar } from "@/components/user-avatar";

export const metadata = { title: "My account · Rolodex" };

export default async function AccountPage() {
  const s = await session();
  if (!s) redirect("/login?next=/account");
  const u = s.user;
  return (
    <>
      <div className="page-head"><div><h1>My account</h1></div></div>
      <div className="form-grid" style={{ maxWidth: 720, gridTemplateColumns: "minmax(0,1fr)" }}>
        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span className="who" style={{ flex: "1 1 220px" }}>
              <UserAvatar name={u.name} large />
              <span style={{ minWidth: 0 }}><strong style={{ fontSize: 18 }}>{u.name}</strong><small>{u.email} · {ROLE_LABELS[u.role]}</small></span>
            </span>
            {/* A plain form post, so signing out works even when the page's scripts don't. */}
            <form action="/api/logout" method="post"><button type="submit" className="btn">Sign out</button></form>
          </div>
          {s.noLogin && <p className="muted" style={{ margin: "14px 0 0", fontSize: 13.5 }}>Sign-in is off on this computer, so you’re signed in as the first owner.</p>}
        </div>
        <AccountForm name={u.name} phone={u.phone} minPassword={MIN_PASSWORD} />
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{u.role === "owner" ? "Change your email or role in Settings → Team." : "To change your email or role, ask an owner."}</p>
      </div>
    </>
  );
}
