import { session } from "@/lib/auth";
import { deletedDirectory } from "@/lib/deleted-directory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await session()) return Response.json({ error: "You were signed out. Sign in again." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || 1), cutoff = params.get("cutoff") || "";
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isFinite(Date.parse(cutoff)) || Date.parse(cutoff) > Date.now() + 1000)
    return Response.json({ error: "Refresh Recently Deleted and try again." }, { status: 400 });
  try {
    return Response.json(await deletedDirectory(page, cutoff), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "More deleted records could not be loaded. Try again." }, { status: 500 });
  }
}
