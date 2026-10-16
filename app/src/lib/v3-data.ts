import { existsSync } from "node:fs";
import path from "node:path";
import "server-only";
import { query } from "./db";

type Row = Record<string, unknown>;
const day = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : null;
const localDay = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) : null;
const values = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try { return JSON.parse(value || "[]"); } catch { return value.startsWith("{") && value.endsWith("}") ? value.slice(1, -1).split(",").filter(Boolean) : []; }
};
const RANK = ["client", "former", "referral", "vendor", "prospect", "friend", "connection"];
const bestKind = (kinds: unknown) => RANK.find((kind) => values(kinds).includes(kind)) ?? null;
const mon = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const linkType = (url: string) => /(^|[/.])linkedin\.com/.test(url) ? "linkedin" : /(^|[/.])(m\.me|messenger\.com)\//.test(url) ? "messenger" : /(^|[/.])(facebook|fb)\.com/.test(url) ? "facebook" : /(^|[/.])(wa\.me|whatsapp\.com)/.test(url) ? "whatsapp" : /(^|[/.])instagram\.com/.test(url) ? "instagram" : /(^|[/.])(twitter|x)\.com(\/|$)/.test(url) ? "x" : /(^|[/.])(youtube\.com|youtu\.be)/.test(url) ? "youtube" : /(^|[/.])threads\.(net|com)/.test(url) ? "threads" : "website";
const normalizeUrl = (value: string) => /^https?:\/\//i.test(value) ? value : "https://" + value.replace(/^\/+/, "");
const linksOf = (row: Row) => {
  const seen = new Set<string>();
  return [row.website, row.linkedin, ...String(row.socials ?? "").split(/[\s,]+/)].map((x) => String(x ?? "").trim()).filter(Boolean).flatMap((raw) => {
    const url = normalizeUrl(raw), key = url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return []; seen.add(key); return [{ type: linkType(url), url }];
  });
};

/** The exact V3 client shape, derived live from the same tables as export-v2-data.mjs. */
export async function v3Data() {
  const [users, companies0, contacts0, links, leads, notes0, deals0, todos0, services] = await Promise.all([
    query<Row>("select id::int, name, email, phone, role, active, signature from users order by id"),
    query<Row>("select * from companies where deleted_at is null order by id"),
    query<Row>("select * from contacts where deleted_at is null order by id"),
    query<Row>("select cc.* from contact_companies cc join companies c on c.id=cc.company_id and c.deleted_at is null order by cc.contact_id, cc.company_id"),
    query<Row>("select company_id::int, contact_id::int from leads where deleted_at is null"),
    query<Row>("select * from notes where deleted_at is null order by coalesce(happened_at, created_at) desc"),
    query<Row>("select * from opportunities where deleted_at is null order by position, id"),
    query<Row>("select * from todos where deleted_at is null order by position, id"),
    query<Row>("select value from settings where key='services'"),
  ]);
  const key = new Map(users.map((u, i) => [Number(u.id), i === 0 ? "bc" : "u" + u.id]));
  const companies = companies0.map((c) => ({ id: Number(c.id), name: String(c.name).trim(), industry: String(c.industry ?? "").split(";")[0].trim(), city: String(c.city ?? ""), kind: null as string | null, website: String(c.website ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), phone: String(c.phone ?? ""), size: String(c.size ?? ""), about: String(c.description ?? ""), next: day(c.next_follow_up) }));
  const contacts = contacts0.map((c) => ({ id: Number(c.id), first: String(c.first_name ?? ""), lastName: String(c.last_name ?? ""), name: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "(No name)", title: String(c.job_title ?? ""), companyId: null as number | null, kind: bestKind(c.kinds), phone: String((values(c.phones)[0] as Row | undefined)?.value ?? ""), email: String((values(c.emails)[0] as Row | undefined)?.value ?? ""), city: String(c.city ?? ""), last: day(c.last_contacted), next: day(c.next_follow_up), cadence: c.keep_in_touch ? Number(c.keep_in_touch) : null, links: [...linksOf(c), ...(values(c.emails) as Row[]).slice(1).map((e) => ({ type: "email", url: "mailto:" + String(e.value ?? "") })).filter((l) => l.url !== "mailto:")], birthday: c.birthday ? mon[new Date(String(c.birthday)).getUTCMonth()] + " " + new Date(String(c.birthday)).getUTCDate() : "", howMet: String(c.how_met ?? ""), introducedBy: "", tags: values(c.tags) }));
  const co = new Set(companies.map((x) => x.id)), ct = new Set(contacts.map((x) => x.id)), byContact = new Map<number, Row>();
  for (const link of links) if (!byContact.has(Number(link.contact_id))) byContact.set(Number(link.contact_id), link);
  const names = new Map(contacts.map((x) => [x.id, x.name]));
  contacts.forEach((c, i) => { const source = contacts0[i], link = byContact.get(c.id); c.companyId = link ? Number(link.company_id) : null; c.title = String(link?.title || c.title); c.introducedBy = source.introduced_by ? names.get(Number(source.introduced_by)) ?? "" : ""; });
  const byCompanyKinds = new Map<number, string[]>();
  for (const link of links) { const person = contacts0.find((x) => Number(x.id) === Number(link.contact_id)); if (person) byCompanyKinds.set(Number(link.company_id), [...(byCompanyKinds.get(Number(link.company_id)) ?? []), ...values(person.kinds) as string[]]); }
  const leadCompanies = new Set(leads.map((x) => Number(x.company_id)).filter(Boolean));
  companies.forEach((c) => { c.kind = bestKind((byCompanyKinds.get(c.id) ?? []).filter((x) => x !== "connection" && x !== "friend")) ?? (leadCompanies.has(c.id) ? "prospect" : null); });
  const deals = deals0.map((d) => ({ id: Number(d.id), name: String(d.name), companyId: co.has(Number(d.company_id)) ? Number(d.company_id) : (byContact.get(Number(d.contact_id)) ? Number(byContact.get(Number(d.contact_id))!.company_id) : null), contactId: ct.has(Number(d.contact_id)) ? Number(d.contact_id) : null, value: Math.round(Number(d.value_cents ?? 0) / 100), stage: String(d.stage), close: day(d.close_date) ?? localDay(d.closed_at), next: day(d.next_follow_up), owner: key.get(Number(d.owner_id)) ?? "bc" }));
  const dealCompany = new Map(deals.map((d) => [d.id, d.companyId]));
  const notes = notes0.flatMap((n) => { let type = "contact", rid = Number(n.contact_id); if (!ct.has(rid)) { type = "company"; rid = co.has(Number(n.company_id)) ? Number(n.company_id) : Number(dealCompany.get(Number(n.opportunity_id))); } if (!rid) return []; const kind = ({ video: "meeting", linkedin: "text" } as Record<string, string>)[String(n.kind)] ?? String(n.kind); return [{ id: Number(n.id), type, rid, kind, date: localDay(n.happened_at ?? n.created_at), body: (n.kind === "introduction" ? "Introduction: " : n.kind === "linkedin" ? "LinkedIn: " : "") + String(n.body), by: key.get(Number(n.author_id)) ?? "bc", att: values(n.attachments) }]; });
  const todos = todos0.map((t) => ({ id: Number(t.id), text: String(t.title), due: day(t.due), who: key.get(Number(t.assigned_to ?? t.created_by)) ?? "bc", link: ct.has(Number(t.contact_id)) ? { type: "contact", id: Number(t.contact_id) } : co.has(Number(t.company_id)) ? { type: "company", id: Number(t.company_id) } : null, done: !!t.done_at, doneAt: localDay(t.done_at), prio: t.high ? 1 : 4, desc: String(t.notes ?? ""), repeat: null, subtasks: values(t.subtasks), comments: values(t.comments), order: Number(t.position || t.id), created: localDay(t.created_at), by: key.get(Number(t.created_by)) ?? "bc", deleted: false }));
  const photos: Record<string, string> = {}, logos: Record<string, string> = {};
  // Only pictures that exist; a missing one would show an empty circle instead of initials.
  const pub = path.join(process.cwd(), "public"), has = (f: string) => existsSync(path.join(pub, f));
  contacts.forEach((c) => { const f = "contact-avatars/" + c.id + "-104.webp"; if (has(f)) photos[c.name] = "/" + f; }); companies.forEach((c) => { const f = "company-avatars/" + c.id + "-104.webp"; if (has(f)) logos[c.name] = "/" + f; });
  const first = users[0] ?? { name: "", email: "", phone: "", signature: "" };
  return { exportedAt: new Date().toISOString(), source: "Rolodex database", team: users.map((u) => ({ k: key.get(Number(u.id)), id: Number(u.id), name: String(u.name), email: String(u.email), role: u.role === "owner" ? "Owner" : "Salesperson", active: u.active === true })), prefs: { name: String(first.name), email: String(first.email), phone: String(first.phone ?? ""), signature: String(first.signature ?? ""), services: services[0] ? String(services[0].value).split("\n").map((x) => x.trim()).filter(Boolean) : [] }, companies, contacts, notes, deals, todos, photos, logos };
}
