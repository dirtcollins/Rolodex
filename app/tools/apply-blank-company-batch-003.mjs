import { PGlite } from "@electric-sql/pglite";

const additions = [
  { id: 136, field: "website", value: "https://www.alanurquhart.com/", sourceUrl: "https://www.alanurquhart.com/" },
  { id: 138, field: "website", value: "https://socialhp.com/", sourceUrl: "https://socialhp.com/about" },
  { id: 138, field: "email", value: "info@socialhp.com", sourceUrl: "https://socialhp.com/about" },
  { id: 152, field: "website", value: "https://wallaroomedia.com/", sourceUrl: "https://wallaroomedia.com/about/" },
  { id: 152, field: "email", value: "info@wallaroomedia.com", sourceUrl: "https://wallaroomedia.com/portfolio/buffalo/" },
  { id: 152, field: "phone", value: "(801) 432-0850", sourceUrl: "https://wallaroomedia.com/portfolio/buffalo/" },
  { id: 175, field: "website", value: "https://whitespark.ca/", sourceUrl: "https://whitespark.ca/darren-shaw-whitespark-founder/" },
  { id: 175, field: "email", value: "support@whitespark.ca", sourceUrl: "https://whitespark.ca/darren-shaw-whitespark-founder/" },
  { id: 175, field: "phone", value: "(855) 406-6050", sourceUrl: "https://whitespark.ca/darren-shaw-whitespark-founder/" },
];

const db = new PGlite(".data/pglite");
const applied = [];
for (const candidate of additions) {
  const current = await db.query(`select ${candidate.field} from companies where id = $1 and deleted_at is null`, [candidate.id]);
  if (current.rows.length !== 1 || current.rows[0][candidate.field]) continue;
  await db.transaction(async (tx) => {
    await tx.query(`update companies set ${candidate.field} = $1, updated_at = now() where id = $2 and ${candidate.field} = ''`, [candidate.value, candidate.id]);
    await tx.query(
      "insert into company_enrichment_sources (company_id, field, value, source_url) values ($1, $2, $3, $4) on conflict do nothing",
      [candidate.id, candidate.field, candidate.value, candidate.sourceUrl],
    );
  });
  applied.push(candidate);
}
console.log(JSON.stringify({ applied }, null, 2));
await db.close();
