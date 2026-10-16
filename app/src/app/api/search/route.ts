import { session } from "@/lib/auth";
import { search } from "@/lib/data";

// The top bar's live search (Light Ops' /api/search): one query per group, all at once.
export async function GET(req: Request) {
  const empty = { contacts: [], companies: [], projects: [], todos: [], notes: [] };
  if (!(await session())) return Response.json(empty, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json(empty);
  return Response.json(await search(q), { headers: { "Cache-Control": "no-store" } });
}
