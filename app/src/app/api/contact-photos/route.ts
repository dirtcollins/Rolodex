import { session } from "@/lib/auth";
import { query } from "@/lib/db";

/** Authenticated metadata for local avatar matching; excludes email addresses, phone numbers and notes. */
export async function GET() {
  if (!await session()) return Response.json({ error: "Sign in to view contacts." }, { status: 401 });
  const contacts = await query<{ id: number; name: string; linkedin: string; socials: string; companies: string[] }>(`select c.id::int,
    trim(c.first_name || ' ' || c.last_name) as name, c.linkedin, c.socials,
    coalesce((select json_agg(co.name order by lower(co.name)) from contact_companies cc
      join companies co on co.id = cc.company_id and co.deleted_at is null where cc.contact_id = c.id), '[]') as companies
    from contacts c where c.deleted_at is null order by lower(c.first_name), lower(c.last_name), c.id`);
  return Response.json({ contacts }, { headers: { "Cache-Control": "no-store" } });
}
