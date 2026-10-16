import { session } from "@/lib/auth";
import { bell, bellSave } from "@/lib/bell";

// The bell's rows, asked for by the bell itself after the page shows, so no page waits on them. POST: its saves (read,
// read-all, dismiss, dismiss-all, undismiss; lib/bell.ts bellSave). A plain address, never a server action (Light Ops,
// 2026-10-13): an action is tied to one release, so a page opened before a release saved nothing after it.
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await session();
  if (!s) return Response.json({ rows: [], unread: 0 }, { status: 401 });
  return Response.json(await bell(s.user.id), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const s = await session();
  if (!s) return Response.json({ ok: false }, { status: 401 });
  // Only this site's own pages may post here (as /api/save).
  const origin = req.headers.get("origin"), host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return Response.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? ""), ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
  if (!["read", "read-all", "dismiss", "dismiss-all", "undismiss"].includes(action)) return Response.json({ ok: false }, { status: 400 });
  return Response.json({ ok: true, ids: await bellSave(s.user.id, action, ids) }, { headers: { "Cache-Control": "no-store" } });
}
