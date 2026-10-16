import { session } from "@/lib/auth";
import { Problem, runAction } from "@/lib/actions";

// Every change: { action, data } in, { ok, id? } or { ok: false, error } out (lib/actions.ts).
export async function POST(req: Request) {
  const s = await session();
  if (!s) return Response.json({ ok: false, error: "You were signed out. Sign in again." }, { status: 401 });
  // Only this site's own pages may post here.
  const origin = req.headers.get("origin"), host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return Response.json({ ok: false, error: "Not allowed." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return Response.json({ ok: false, error: "Nothing to save." }, { status: 400 });
  try {
    return Response.json({ ok: true, ...(await runAction(body.action, body.data ?? {}, s)) });
  } catch (e) {
    if (e instanceof Problem) return Response.json({ ok: false, error: e.message }, { status: 422 });
    console.error("Rolodex save " + body.action + ":", (e as Error).message);
    return Response.json({ ok: false, error: "That didn’t save. Try again." }, { status: 500 });
  }
}
