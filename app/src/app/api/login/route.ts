import { SESSION_COOKIE, cookieOptions, safeNext, signIn } from "@/lib/auth";

// The sign-in form posts here (a plain form, so it works before the page's scripts load and after any release).
export async function POST(req: Request) {
  const fd = await req.formData();
  const next = safeNext(String(fd.get("next") ?? ""));
  const cookie = await signIn(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), req.headers);
  const res = (to: string) => new Response(null, { status: 303, headers: { Location: to } });
  if (!cookie) {
    await new Promise((r) => setTimeout(r, 1000)); // a wrong try waits a second
    return res("/login?error=1" + (next !== "/dashboard" ? "&next=" + encodeURIComponent(next) : ""));
  }
  const r = res(next), o = cookieOptions();
  r.headers.append("Set-Cookie", `${SESSION_COOKIE}=${cookie}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`);
  return r;
}
