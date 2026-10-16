import { session } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Read-only working set for verified, missing-field company research. */
export async function GET() {
  if (!await session()) return Response.json({ error: "Sign in to view companies." }, { status: 401 });
  const companies = await query<{ id: number; name: string; website: string; email: string; phone: string; city: string; state: string; street: string; zip: string; industry: string; tags: string[]; people: { name: string; title: string }[] }>(
    `select co.id::int, co.name, co.website, co.email, co.phone, co.city, co.state, co.street, co.zip, co.industry, co.tags,
     coalesce((select json_agg(json_build_object('name', trim(c.first_name || ' ' || c.last_name), 'title', cc.title))
       from contact_companies cc join contacts c on c.id = cc.contact_id and c.deleted_at is null where cc.company_id = co.id), '[]') as people
     from companies co where co.deleted_at is null order by lower(co.name), co.id`);
  return Response.json({ companies }, { headers: { "Cache-Control": "no-store" } });
}
