import { readFile, writeFile } from "node:fs/promises";

const all = JSON.parse(await readFile("/private/tmp/rolodex-company-websites-missing-email.json", "utf8"));
const startAt = Math.max(0, Number(process.argv[2] ?? 0));
const endAt = Math.min(all.length, Math.max(startAt, Number(process.argv[3] ?? all.length)));
const input = all.slice(startAt, endAt);
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ignored = /@(example\.(com|org|net)|email\.com|domain\.com|yourdomain\.com)$/i;
const clean = (value) => value.replace(/[),.;:]+$/, "").toLowerCase();

async function inspect(company) {
  let start;
  try {
    start = new URL(company.website);
  } catch {
    return { ...company, result: "invalid-existing-website", candidates: [] };
  }
  const pages = new Map([[start.href, null]]);
  try {
    const response = await fetch(start, { redirect: "follow", signal: AbortSignal.timeout(4_000), headers: { "User-Agent": "Rolodex verified-business-contact audit" } });
    const html = await response.text();
    pages.set(response.url, html);
  } catch (error) {
    return { ...company, result: `fetch-failed:${error.cause?.code ?? error.name}`, candidates: [] };
  }
  const found = new Map();
  for (const [url, html] of pages) {
    if (!html) continue;
    for (const raw of html.match(emailPattern) ?? []) {
      const email = clean(raw);
      if (!ignored.test(email)) found.set(email, url);
    }
    for (const encoded of html.match(/mailto:([^"'?#\s>]+)/gi) ?? []) {
      const email = clean(decodeURIComponent(encoded.slice(7)));
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !ignored.test(email)) found.set(email, url);
    }
  }
  const domain = new URL([...pages.keys()][0]).hostname.replace(/^www\./, "");
  const candidates = [...found].filter(([email]) => email.endsWith(`@${domain}`));
  return { ...company, result: "ok", candidates: candidates.map(([email, sourceUrl]) => ({ email, sourceUrl })), allFound: [...found.keys()] };
}

const output = [];
for (let index = 0; index < input.length; index += 20) {
  output.push(...await Promise.all(input.slice(index, index + 20).map(inspect)));
  console.error(`audited ${Math.min(index + 20, input.length)}/${input.length}`);
}
await writeFile(`/private/tmp/rolodex-company-email-audit-${startAt}-${endAt}.json`, JSON.stringify(output, null, 2));
console.log(JSON.stringify({ range: [startAt, endAt], audited: output.length, verifiedCompanyDomainEmails: output.reduce((total, row) => total + row.candidates.length, 0) }));
