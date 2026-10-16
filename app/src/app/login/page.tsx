import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { Wordmark } from "@/components/wordmark";

export const metadata = { title: "Sign in · Rolodex" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  if (await session()) redirect(sp.next || "/dashboard");
  return (
    <main className="login">
      <form className="login-card" method="post" action="/api/login">
        <Wordmark />
        <h1>Rolodex</h1>
        <p className="muted">Sign in to your Collins Creative Rolodex.</p>
        {sp.error && <p className="form-error" role="alert">{sp.error === "short" ? "Choose a password of at least 12 characters. It becomes your password." : "That email and password don’t match. Try again."}</p>}
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <label className="field"><span>Email</span><input className="in" type="email" name="email" autoComplete="username" required autoFocus /></label>
        <label className="field"><span>Password</span><input className="in" type="password" name="password" autoComplete="current-password" required /></label>
        <button className="btn btn-primary btn-lg" type="submit">Sign in</button>
      </form>
    </main>
  );
}
