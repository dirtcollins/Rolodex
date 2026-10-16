import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const audit = JSON.parse(await readFile("/private/tmp/rolodex-company-email-audit-0-90.json", "utf8"));
const selected = new Map([
  [4, "info@rainforrent.com"], [12, "info@bolthouseproperties.com"], [18, "marketing@gemcorp.com"],
  [24, "bd@cbcc.global"], [25, "info@prosoft-technology.com"], [26, "info@bortonpetrini.com"],
  [29, "sales@coxpetroleum.com"], [36, "ccp@gensets.com"], [52, "customerservice@insectlore.com"],
  [66, "local@bakersfield.com"], [68, "info@eclipseconstructionservices.com"], [69, "info@asi-inc.net"],
  [71, "info@braunelec.com"], [73, "servicedesk@ndti.net"], [77, "admin@cbfrontier.com"],
  [80, "sales@gregspetro.com"], [82, "marketing@abm1.com"], [88, "info@hronis.net"],
  [92, "salesinfo@johnstonfarms.com"], [94, "sales@sunviewmarketing.com"], [97, "sales@aclifts.com"],
]);
const db = new PGlite(".data/pglite");
await db.exec(`create table if not exists company_enrichment_sources (
  id bigint generated always as identity primary key, company_id bigint not null references companies(id) on delete cascade,
  field text not null check (field in ('website', 'email', 'phone')), value text not null, source_url text not null,
  added_at timestamptz not null default now(), added_by bigint references users(id), unique (company_id, field, value, source_url)
); create index if not exists company_enrichment_sources_company on company_enrichment_sources (company_id, added_at desc);`);
const results = [];
for (const row of audit) {
  const email = selected.get(row.id);
  const candidate = email && row.candidates.find((item) => item.email === email);
  if (!candidate) continue;
  const existing = await db.query("select name, email from companies where id = $1 and deleted_at is null", [row.id]);
  if (existing.rows.length !== 1 || existing.rows[0].name !== row.name || String(existing.rows[0].email).trim()) {
    results.push({ id: row.id, name: row.name, status: "skipped-concurrent-or-changed" });
    continue;
  }
  await db.transaction(async (tx) => {
    await tx.query("update companies set email = $2, updated_at = now() where id = $1 and nullif(trim(email), '') is null", [row.id, email]);
    await tx.query("insert into company_enrichment_sources (company_id, field, value, source_url) values ($1, 'email', $2, $3) on conflict do nothing", [row.id, email, candidate.sourceUrl]);
  });
  results.push({ id: row.id, name: row.name, email, sourceUrl: candidate.sourceUrl, status: "added" });
}
console.log(JSON.stringify({ added: results.filter((row) => row.status === "added").length, results }, null, 2));
await db.close();
