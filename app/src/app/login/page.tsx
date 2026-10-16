import { redirect } from "next/navigation";
import { session } from "@/lib/auth";

export const metadata = { title: "Sign in · Rolodex" };

// Sign-in in V3's look: warm gray page, white card, Onest, blue primary button.
const field = { width: "100%", height: 40, padding: "0 12px", border: "1px solid #E3E1DA", borderRadius: 9, background: "#fff", fontSize: 14, fontFamily: "inherit", color: "#17181C", outline: "none", boxSizing: "border-box" } as const;
const label = { display: "block", fontSize: 13, fontWeight: 550, color: "#3E4048", margin: "14px 0 6px" } as const;

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  if (await session()) redirect(sp.next || "/v3");
  return (
    <main style={{ position: "fixed", inset: 0, overflow: "auto", background: "#F4F3EF", display: "grid", placeItems: "center", padding: 16, fontFamily: "'Onest', ui-sans-serif, system-ui, sans-serif", color: "#17181C", WebkitFontSmoothing: "antialiased" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap" />
      <form method="post" action="/api/login" style={{ width: "min(380px, 100%)", padding: "28px 28px 24px", background: "#fff", border: "1px solid #E7E5DF", borderRadius: 14, boxShadow: "0 1px 2px rgba(23,24,28,.04), 0 4px 16px rgba(23,24,28,.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
          <img src="/rolodex-logo.png" alt="" width={28} height={28} style={{ borderRadius: 7 }} />
          <span style={{ fontSize: 16, fontWeight: 650, letterSpacing: "-.02em" }}>Rolodex</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 650, letterSpacing: "-.03em" }}>Sign in</h1>
        <p style={{ margin: "4px 0 6px", fontSize: 14, color: "#6E6F76" }}>Your Collins Creative Rolodex.</p>
        {sp.error && <p role="alert" style={{ margin: "12px 0 0", padding: "9px 12px", borderRadius: 9, background: "#FBEAE6", color: "#B03A22", fontSize: 13 }}>{sp.error === "short" ? "Choose a password of at least 12 characters. It becomes your password." : "That email and password don’t match. Try again."}</p>}
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <label style={label} htmlFor="email">Email</label>
        <input id="email" style={field} type="email" name="email" autoComplete="username" required autoFocus />
        <label style={label} htmlFor="password">Password</label>
        <input id="password" style={field} type="password" name="password" autoComplete="current-password" required />
        <button type="submit" style={{ width: "100%", height: 40, marginTop: 20, border: 0, borderRadius: 9, background: "#2F5BEA", color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Sign in</button>
      </form>
    </main>
  );
}
