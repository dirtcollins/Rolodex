import { session } from "@/lib/auth";
import { companyDirectory, contactDirectory, type CompanySort, type ContactSort } from "@/lib/data";

export const dynamic = "force-dynamic";

/** The same database filters as the directory's first batch, with bounded incremental responses. */
export async function GET(request: Request) {
  if (!await session()) return Response.json({ error: "You were signed out. Sign in again." }, { status: 401 });
  const sp = new URL(request.url).searchParams, kind = sp.get("kind");
  const value = (key: string) => sp.get(key)?.slice(0, 200) || undefined;
  const page = Number(sp.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1) return Response.json({ error: "Invalid directory page." }, { status: 400 });
  try {
  if (kind === "contacts") {
    const sort = value("sort");
    const directory = await contactDirectory({ q: value("q"), tag: value("tag"), kind: value("contactKind"),
      sort: (["name", "recent", "follow_up", "last_contacted"].includes(sort || "") ? sort : "name") as ContactSort }, page);
    return Response.json(directory, { headers: { "Cache-Control": "no-store" } });
  }
  if (kind === "companies") {
    const sort = value("sort");
    const directory = await companyDirectory({ q: value("q"), tag: value("tag"), industry: value("industry"),
      sort: (["name", "recent", "follow_up"].includes(sort || "") ? sort : "name") as CompanySort }, page);
    return Response.json(directory, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ error: "Choose a contact or company directory." }, { status: 400 });
  } catch {
    return Response.json({ error: "More records could not be loaded. Try again." }, { status: 500 });
  }
}
