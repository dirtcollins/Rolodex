import { PGlite } from "@electric-sql/pglite";

const additions = [
  { id: 134, field: "website", value: "https://www.steamrolleranimation.com/", sourceUrl: "https://www.steamrolleranimation.com/news" },
  { id: 163, field: "website", value: "https://fairygodmotherco.com/", sourceUrl: "https://fairygodmotherco.com/about/" },
  { id: 163, field: "phone", value: "(661) 808-7816", sourceUrl: "https://fairygodmotherco.com/" },
];

const db = new PGlite(".data/pglite");
const applied = [];
for (const candidate of additions) {
  const current = await db.query(`select ${candidate.field} from companies where id = $1 and deleted_at is null`, [candidate.id]);
  if (current.rows.length !== 1 || current.rows[0][candidate.field]) continue;
  await db.transaction(async (tx) => {
    await tx.query(`update companies set ${candidate.field} = $1, updated_at = now() where id = $2 and ${candidate.field} = ''`, [candidate.value, candidate.id]);
    await tx.query("insert into company_enrichment_sources (company_id, field, value, source_url) values ($1, $2, $3, $4) on conflict do nothing", [candidate.id, candidate.field, candidate.value, candidate.sourceUrl]);
  });
  applied.push(candidate);
}
console.log(JSON.stringify({ applied }, null, 2));
await db.close();
