import { session } from "@/lib/auth";
import { possibleDuplicates } from "@/lib/data";

// "Is this one already in Rolodex?" while a contact or company is being added (Brendan: no duplicates).
// ?type=contact&first=&last=&email=&phone=  or  ?type=company&name=&website=   (&not=<id> when editing)
export async function GET(req: Request) {
  if (!(await session())) return Response.json({ ok: false }, { status: 401 });
  const q = new URL(req.url).searchParams, not = Number(q.get("not")) || undefined;
  const found = q.get("type") === "company"
    ? await possibleDuplicates({ type: "company", name: q.get("name") ?? "", website: q.get("website") ?? "", not })
    : await possibleDuplicates({ type: "contact", first: q.get("first") ?? "", last: q.get("last") ?? "", emails: q.getAll("email"), phones: q.getAll("phone"), not });
  return Response.json({ ok: true, found }, { headers: { "Cache-Control": "no-store" } });
}
