import "server-only";
import { cache } from "react";
import { query, one } from "./db";
import { TZ, addDays, daysBetween, fullName, today } from "./format";

// Every screen reads through these. Dates leave the database as text (YYYY-MM-DD) and moments as ISO, so PGlite and
// Supabase answer the same and nothing shifts a day by time zone.

const TODAY_SQL = `(now() at time zone '${TZ}')::date`;
const iso = (col: string) => `to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

export interface Labeled { label: string; value: string }
export interface CompanyRef { id: number; name: string; title: string }
export interface Contact {
  id: number; first_name: string; last_name: string; name: string; job_title: string; kinds: string[]; tags: string[];
  phones: Labeled[]; emails: Labeled[]; website: string; linkedin: string; socials: string; city: string; state: string;
  birthday: string | null; how_met: string; introduced_by: number | null; introducer: string | null;
  owner_id: number | null; owner: string | null; last_contacted: string | null; next_follow_up: string | null; keep_in_touch: number | null;
  companies: CompanyRef[]; created_at: string;
}
export interface Company {
  id: number; name: string; industry: string; description: string; website: string; phone: string; email: string;
  street: string; city: string; state: string; zip: string; linkedin: string; socials: string; size: string; revenue: string; tech: string;
  needs: string[]; tags: string[]; owner_id: number | null; owner: string | null; next_follow_up: string | null; people: number; created_at: string;
}
export interface Note { id: number; kind: string; body: string; day_only: boolean; author: string | null; created_at: string; contact_id: number | null; company_id: number | null; about: string | null;
  /** Set when the note was logged on a project (a person's and a company's history show those too). */
  opportunity_id?: number | null; project?: string | null }
export interface Todo { id: number; title: string; notes: string; due: string | null; high: boolean; done_at: string | null; assigned_to: number | null; assignee: string | null; contact_id: number | null; contact: string | null; company_id: number | null; company: string | null; opportunity_id: number | null; project: string | null }

const CONTACT_COLS = `c.id::int, c.first_name, c.last_name, c.job_title, c.kinds, c.tags, c.phones, c.emails, c.website, c.linkedin, c.socials,
  c.city, c.state, c.birthday::text, c.how_met, c.introduced_by::int, nullif(trim(i.first_name || ' ' || i.last_name), '') as introducer,
  c.owner_id::int, u.name as owner, c.last_contacted::text, c.next_follow_up::text, c.keep_in_touch, ${iso("c.created_at")} as created_at,
  coalesce((select json_agg(json_build_object('id', co.id, 'name', co.name, 'title', cc.title) order by lower(co.name))
    from contact_companies cc join companies co on co.id = cc.company_id and co.deleted_at is null where cc.contact_id = c.id), '[]') as companies`;
const CONTACT_FROM = `contacts c left join contacts i on i.id = c.introduced_by and i.deleted_at is null left join users u on u.id = c.owner_id`;

const asContact = (r: Record<string, unknown>): Contact => {
  const c = r as unknown as Contact;
  const parse = <T,>(v: unknown, d: T): T => (typeof v === "string" ? JSON.parse(v) : (v ?? d)) as T;
  return { ...c, phones: parse(r.phones, []), emails: parse(r.emails, []), companies: parse(r.companies, []), kinds: c.kinds ?? [], tags: c.tags ?? [], name: fullName(c) };
};

export type ContactSort = "name" | "recent" | "follow_up" | "last_contacted";
type ContactFilters = { q?: string; tag?: string; kind?: string; sort?: ContactSort; company?: number };
function contactFilter(o: ContactFilters) {
  const where = ["c.deleted_at is null"], p: unknown[] = [];
  if (o.q?.trim()) {
    p.push("%" + o.q.trim().toLowerCase() + "%");
    where.push(`(lower(c.first_name || ' ' || c.last_name) like $${p.length} or lower(c.job_title) like $${p.length} or lower(c.emails::text) like $${p.length}
      or lower(c.city) like $${p.length} or exists (select 1 from contact_companies cc join companies co on co.id = cc.company_id where cc.contact_id = c.id and lower(co.name) like $${p.length}))`);
  }
  if (o.tag) { p.push(o.tag); where.push(`$${p.length} = any(c.tags)`); }
  if (o.kind) { p.push(o.kind); where.push(`$${p.length} = any(c.kinds)`); }
  if (o.company) { p.push(o.company); where.push(`exists (select 1 from contact_companies cc where cc.contact_id = c.id and cc.company_id = $${p.length})`); }
  const order = { name: "lower(c.first_name), lower(c.last_name)", recent: "c.created_at desc", follow_up: "c.next_follow_up nulls last, lower(c.first_name)", last_contacted: "c.last_contacted nulls first, lower(c.first_name)" }[o.sort ?? "name"];
  return { where: where.join(" and "), params: p, order: order + ", c.id" };
}
export async function listContacts(o: ContactFilters = {}): Promise<Contact[]> {
  const f = contactFilter(o);
  return (await query(`select ${CONTACT_COLS} from ${CONTACT_FROM} where ${f.where} order by ${f.order} limit 2000`, f.params)).map(asContact);
}
export type ContactListItem = Pick<Contact, "id" | "name" | "job_title" | "kinds" | "phones" | "emails" | "companies" | "next_follow_up" | "last_contacted">;
export const DIRECTORY_PAGE_SIZE = 50;
export interface DirectoryPage<T> { items: T[]; total: number; page: number; pages: number; pageSize: number }
function directoryBounds(total: number, requested: number) {
  const pages = Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  return { total, page, pages, pageSize: DIRECTORY_PAGE_SIZE };
}
/** Directory rows only. Record histories, descriptions and private form fields stay on record pages. */
export async function contactDirectory(o: ContactFilters = {}, requested = 1): Promise<DirectoryPage<ContactListItem>> {
  const f = contactFilter(o);
  const total = (await one<{ total: number }>(`select count(*)::int as total from contacts c where ${f.where}`, f.params))!.total;
  const bounds = directoryBounds(total, requested), p = [...f.params, DIRECTORY_PAGE_SIZE, (bounds.page - 1) * DIRECTORY_PAGE_SIZE];
  const rows = await query(`select c.id::int, c.first_name, c.last_name, c.job_title, c.kinds, c.phones, c.emails,
    c.next_follow_up::text, c.last_contacted::text,
    coalesce((select json_agg(json_build_object('id', co.id, 'name', co.name, 'title', cc.title) order by lower(co.name))
      from contact_companies cc join companies co on co.id = cc.company_id and co.deleted_at is null where cc.contact_id = c.id), '[]') as companies
    from contacts c where ${f.where} order by ${f.order} limit $${p.length - 1} offset $${p.length}`, p);
  return { ...bounds, items: rows.map((r) => {
    const parse = <T,>(v: unknown, fallback: T): T => (typeof v === "string" ? JSON.parse(v) : v ?? fallback) as T;
    return { id: Number(r.id), name: fullName({ first_name: String(r.first_name), last_name: String(r.last_name) }),
      job_title: String(r.job_title), kinds: (r.kinds ?? []) as string[], phones: parse<Labeled[]>(r.phones, []), emails: parse<Labeled[]>(r.emails, []),
      companies: parse<CompanyRef[]>(r.companies, []), next_follow_up: r.next_follow_up as string | null, last_contacted: r.last_contacted as string | null };
  }) };
}
export const contactById = cache(async (id: number): Promise<Contact | null> => {
  const r = await one(`select ${CONTACT_COLS} from ${CONTACT_FROM} where c.id = $1 and c.deleted_at is null`, [id]);
  return r ? asContact(r) : null;
});
/** People this contact introduced (Phase 2 grows this into the Network). */
export async function introducedBy(id: number): Promise<{ id: number; name: string }[]> {
  return (await query<{ id: number; first_name: string; last_name: string }>("select id::int, first_name, last_name from contacts where introduced_by = $1 and deleted_at is null order by lower(first_name)", [id])).map((r) => ({ id: r.id, name: fullName(r) }));
}

const COMPANY_COLS = `co.id::int, co.name, co.industry, co.description, co.website, co.phone, co.email, co.street, co.city, co.state, co.zip, co.linkedin,
  co.socials, co.size, co.revenue, co.tech, co.needs, co.tags, co.owner_id::int, u.name as owner, co.next_follow_up::text, ${iso("co.created_at")} as created_at,
  (select count(*)::int from contact_companies cc join contacts c on c.id = cc.contact_id and c.deleted_at is null where cc.company_id = co.id) as people`;
export type CompanySort = "name" | "recent" | "follow_up";
type CompanyFilters = { q?: string; tag?: string; industry?: string; sort?: CompanySort };
function companyFilter(o: CompanyFilters) {
  const where = ["co.deleted_at is null"], p: unknown[] = [];
  if (o.q?.trim()) { p.push("%" + o.q.trim().toLowerCase() + "%"); where.push(`(lower(co.name) like $${p.length} or lower(co.industry) like $${p.length} or lower(co.city) like $${p.length} or lower(co.website) like $${p.length})`); }
  if (o.tag) { p.push(o.tag); where.push(`$${p.length} = any(co.tags)`); }
  if (o.industry) { p.push(o.industry); where.push(`co.industry = $${p.length}`); }
  const order = { name: "lower(co.name)", recent: "co.created_at desc", follow_up: "co.next_follow_up nulls last, lower(co.name)" }[o.sort ?? "name"];
  return { where: where.join(" and "), params: p, order: order + ", co.id" };
}
export async function listCompanies(o: CompanyFilters = {}): Promise<Company[]> {
  const f = companyFilter(o);
  return query<Company>(`select ${COMPANY_COLS} from companies co left join users u on u.id = co.owner_id where ${f.where} order by ${f.order} limit 2000`, f.params);
}
export type CompanyListItem = Pick<Company, "id" | "name" | "industry" | "city" | "people" | "next_follow_up" | "website">;
export async function companyDirectory(o: CompanyFilters = {}, requested = 1): Promise<DirectoryPage<CompanyListItem>> {
  const f = companyFilter(o);
  const total = (await one<{ total: number }>(`select count(*)::int as total from companies co where ${f.where}`, f.params))!.total;
  const bounds = directoryBounds(total, requested), p = [...f.params, DIRECTORY_PAGE_SIZE, (bounds.page - 1) * DIRECTORY_PAGE_SIZE];
  const items = await query<CompanyListItem>(`select co.id::int, co.name, co.industry, co.city, co.website, co.next_follow_up::text,
    (select count(*)::int from contact_companies cc join contacts c on c.id = cc.contact_id and c.deleted_at is null where cc.company_id = co.id) as people
    from companies co where ${f.where} order by ${f.order} limit $${p.length - 1} offset $${p.length}`, p);
  return { ...bounds, items };
}
export const companyById = cache((id: number) => one<Company>(`select ${COMPANY_COLS} from companies co left join users u on u.id = co.owner_id where co.id = $1 and co.deleted_at is null`, [id]));
/** Every company, for pickers (name only). */
/** Name, industry and tags of every company (the Add leads popup: pick by tag or industry). */
export const companyTags = () => query<{ id: number; name: string; industry: string; tags: string[] }>("select id::int, name, industry, tags from companies where deleted_at is null order by lower(name)");
export const companyNames = cache(() => query<{ id: number; name: string }>("select id::int, name from companies where deleted_at is null order by lower(name)"));
export const contactNames = cache(async () => (await query<{ id: number; first_name: string; last_name: string }>("select id::int, first_name, last_name from contacts where deleted_at is null order by lower(first_name), lower(last_name)")).map((r) => ({ id: r.id, name: fullName(r) })));

/**
 * A person's or a company's whole history: their own notes, notes logged on their projects, and for a company its
 * people's notes too (not people who were deleted).
 */
export async function notesFor(o: { contact?: number; company?: number }): Promise<Note[]> {
  const by = o.contact
    ? "(n.contact_id = $1 or n.opportunity_id in (select id from opportunities where contact_id = $1))"
    : "(n.company_id = $1 or n.contact_id in (select contact_id from contact_companies where company_id = $1) or n.opportunity_id in (select id from opportunities where company_id = $1))";
  return query<Note>(`select n.id::int, n.kind, n.body, u.name as author, ${iso("coalesce(n.happened_at, n.created_at)")} as created_at, (n.happened_at is not null) as day_only, n.contact_id::int, n.company_id::int,
      case when n.contact_id is not null and $2::boolean then nullif(trim(c.first_name || ' ' || c.last_name), '') end as about, n.opportunity_id::int, o.name as project
    from notes n left join users u on u.id = n.author_id left join contacts c on c.id = n.contact_id left join opportunities o on o.id = n.opportunity_id
    where ${by} and n.deleted_at is null and (c.id is null or c.deleted_at is null) and (o.id is null or o.deleted_at is null)
    order by coalesce(n.happened_at, n.created_at) desc limit 300`, [o.contact ?? o.company, !o.contact]);
}

const TODO_COLS = `t.id::int, t.title, t.notes, t.due::text, t.high, ${iso("t.done_at")} as done_at, t.assigned_to::int, u.name as assignee,
  t.contact_id::int, nullif(trim(c.first_name || ' ' || c.last_name), '') as contact, t.company_id::int, co.name as company, t.opportunity_id::int, o.name as project`;
const TODO_FROM = `todos t left join users u on u.id = t.assigned_to left join contacts c on c.id = t.contact_id and c.deleted_at is null left join companies co on co.id = t.company_id and co.deleted_at is null
  left join opportunities o on o.id = t.opportunity_id and o.deleted_at is null`;
export async function listTodos(o: { done?: boolean; mine?: number; contact?: number; company?: number } = {}): Promise<Todo[]> {
  const where = ["t.deleted_at is null", o.done ? "t.done_at is not null" : "t.done_at is null"], p: unknown[] = [];
  if (o.mine) { p.push(o.mine); where.push(`(t.assigned_to = $${p.length} or t.assigned_to is null)`); }
  if (o.contact) { p.push(o.contact); where.push(`t.contact_id = $${p.length}`); }
  if (o.company) { p.push(o.company); where.push(`t.company_id = $${p.length}`); }
  return query<Todo>(`select ${TODO_COLS} from ${TODO_FROM} where ${where.join(" and ")} order by ${o.done ? "t.done_at desc" : "t.due nulls last, t.high desc, t.created_at"} limit 500`, p);
}

/**
 * Who should I contact today? (Docs, the signature feature.) Everyone with a follow-up due or past, and everyone their
 * keep-in-touch rhythm says is due. Late follow-ups first, then today's, then the longest out of touch. Phase 3 adds
 * open opportunities to the same list.
 */
export interface Reach { contact: Contact; why: string; tone: "late" | "due" | "touch"; rank: number }
export async function whoToContact(limit = 12): Promise<Reach[]> {
  const t = today();
  // Projects whose follow-up is due reach their main person (Docs: "based on due follow-ups, active opportunities…").
  const projects = await query<{ contact_id: number; name: string; next_follow_up: string }>(`select contact_id::int, name, next_follow_up::text from opportunities
    where deleted_at is null and contact_id is not null and next_follow_up <= ${TODAY_SQL} and stage in ('lead','meeting','proposal_sent','negotiating')`);
  const ids = projects.map((p) => p.contact_id);
  const rows = (await query(`select ${CONTACT_COLS} from ${CONTACT_FROM} where c.deleted_at is null and (c.next_follow_up <= ${TODAY_SQL}
      or (c.keep_in_touch is not null and (c.last_contacted is null or c.last_contacted + c.keep_in_touch <= ${TODAY_SQL})) or c.id = any($1::bigint[]))`, [ids])).map(asContact);
  const out: Reach[] = [];
  for (const c of rows) {
    const p = projects.filter((x) => x.contact_id === c.id).sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up))[0];
    const due = [c.next_follow_up, p?.next_follow_up].filter((x): x is string => !!x && x <= t).sort()[0];
    if (due) {
      const late = daysBetween(due, t), project = p && p.next_follow_up === due ? " · " + p.name : "";
      out.push({ contact: c, tone: late > 0 ? "late" : "due", why: (late > 0 ? "Follow-up " + late + (late === 1 ? " day" : " days") + " late" : "Follow-up due today") + project, rank: 1000 + late });
    } else if (c.keep_in_touch) {
      const since = c.last_contacted ? daysBetween(c.last_contacted, t) : null;
      const over = since === null ? c.keep_in_touch : since - c.keep_in_touch;
      out.push({ contact: c, tone: "touch", why: since === null ? "Keep in touch · no touch logged yet" : "Last in touch " + since + " days ago", rank: over });
    }
  }
  return out.sort((a, b) => b.rank - a.rank).slice(0, limit);
}

export async function dashboardCounts() {
  const t = today(), week = addDays(t, -7);
  return (await one<{ contacts: number; companies: number; new_contacts: number; due: number; late: number; todos: number }>(`select
    (select count(*)::int from contacts where deleted_at is null) as contacts,
    (select count(*)::int from companies where deleted_at is null) as companies,
    (select count(*)::int from contacts where deleted_at is null and created_at >= $1::date) as new_contacts,
    (select count(*)::int from contacts where deleted_at is null and next_follow_up = $2::date) as due,
    (select count(*)::int from contacts where deleted_at is null and next_follow_up < $2::date) as late,
    (select count(*)::int from todos where deleted_at is null and done_at is null) as todos`, [week, t]))!;
}
export const recentContacts = async (n = 6) => (await query(`select ${CONTACT_COLS} from ${CONTACT_FROM} where c.deleted_at is null order by c.created_at desc limit $1`, [n])).map(asContact);
export const recentNotes = (n = 8) => query<Note>(`select n.id::int, n.kind, n.body, u.name as author, ${iso("coalesce(n.happened_at, n.created_at)")} as created_at, (n.happened_at is not null) as day_only, n.contact_id::int, n.company_id::int,
    coalesce(nullif(trim(c.first_name || ' ' || c.last_name), ''), co.name) as about
  from notes n left join users u on u.id = n.author_id left join contacts c on c.id = n.contact_id left join companies co on co.id = n.company_id
  where n.deleted_at is null and (c.id is null or c.deleted_at is null) and (co.id is null or co.deleted_at is null) order by coalesce(n.happened_at, n.created_at) desc limit $1`, [n]);

/** Tags in use (contacts and companies together), most used first, for filters and pickers. */
export const allTags = cache(async () => (await query<{ tag: string }>(`select tag from (select unnest(tags) as tag from contacts where deleted_at is null
  union all select unnest(tags) from companies where deleted_at is null) t group by tag order by count(*) desc, lower(tag)`)).map((r) => r.tag));
export const allIndustries = async () => (await query<{ i: string }>("select distinct industry as i from companies where deleted_at is null and industry <> '' order by 1")).map((r) => r.i);
export const services = async () => ((await one<{ value: string }>("select value from settings where key = 'services'"))?.value ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
export const team = cache(() => query<{ id: number; name: string }>("select id::int, name from users where active order by lower(name)"));

// Search (the top bar, ⌘K), Light Ops' way: case, spaces and punctuation don't matter in names ("obrien" finds
// "O'Brien", "johnsmith" finds "John Smith"), and a phone number matches by its digits ("6614442857" finds
// "(661) 444-2857"). Names rank exact first, then starts-with, then a word starting with it, then anywhere; a match
// on another field (email, job title, city, tags…) comes after. Leads, Network, Activities and Outreach are hidden
// areas (Brendan, 2026-10-15), so nothing from them is searched.
export interface SearchResults {
  contacts: { id: number; name: string; sub: string }[];
  companies: { id: number; name: string; sub: string }[];
  projects: { id: number; name: string; company: string; stage: string; value_cents: number }[];
  todos: { id: number; title: string; done: boolean; due: string | null; about: string | null; contact_id: number | null; company_id: number | null; opportunity_id: number | null }[];
  notes: { id: number; kind: string; body: string; about: string | null; contact_id: number | null; company_id: number | null; opportunity_id: number | null }[];
}
const NO_RESULTS: SearchResults = { contacts: [], companies: [], projects: [], todos: [], notes: [] };
/** The rank of a match on `name` (already lowercased): 0 exact, 1 starts with, 2 a word starts with, 3 anywhere, 4 other field. */
const nameRank = (name: string) => `case when ${name} = $3 or ($4 <> '' and regexp_replace(${name}, '[^a-z0-9]', '', 'g') = $4) then 0
  when ${name} like $3 || '%' then 1 when (' ' || ${name}) like '% ' || $3 || '%' then 2
  when ${name} like $1 or ($4 <> '' and regexp_replace(${name}, '[^a-z0-9]', '', 'g') like $2) then 3 else 4 end`;
const nameHit = (name: string) => `(${name} like $1 or ($4 <> '' and regexp_replace(${name}, '[^a-z0-9]', '', 'g') like $2))`;
export async function search(text: string): Promise<SearchResults> {
  const q = text.trim().slice(0, 100).toLowerCase().replace(/[%_\\]/g, "").replace(/\s+/g, " ");
  if (q.length < 2) return NO_RESULTS;
  const compact = q.replace(/[^a-z0-9]/g, "");
  // Digits only when what's typed looks like a phone number, so "a1" doesn't match every phone with a 1 in it.
  const digits = /^[\d\s()+.\-]+$/.test(q) && q.replace(/\D/g, "").length >= 3 ? q.replace(/\D/g, "") : "";
  const p = ["%" + q + "%", "%" + compact + "%", q, compact];
  const contactName = "lower(trim(c.first_name || ' ' || c.last_name))";
  const [contacts, companies, projects, todos, notes] = await Promise.all([
    query<{ id: number; first_name: string; last_name: string; sub: string }>(`select c.id::int, c.first_name, c.last_name,
        concat_ws(' · ', nullif(c.job_title, ''), (select co.name from contact_companies cc join companies co on co.id = cc.company_id
          where cc.contact_id = c.id and co.deleted_at is null order by co.name limit 1), nullif(c.city, '')) as sub
      from contacts c where c.deleted_at is null and (${nameHit(contactName)}
        or lower(coalesce((select string_agg(e->>'value', ' ') from jsonb_array_elements(c.emails) e), '')) like $1
        or ($5 <> '' and regexp_replace(coalesce((select string_agg(x->>'value', ' ') from jsonb_array_elements(c.phones) x), ''), '[^0-9]', '', 'g') like '%' || $5 || '%')
        or lower(c.job_title) like $1 or lower(c.city) like $1 or exists (select 1 from unnest(c.tags) t where lower(t) like $1))
      order by ${nameRank(contactName)}, ${contactName} limit 6`, [...p, digits]),
    query<SearchResults["companies"][number]>(`select co.id::int, co.name, concat_ws(' · ', nullif(co.industry, ''), nullif(co.city, '')) as sub
      from companies co where co.deleted_at is null and (${nameHit("lower(co.name)")} or lower(co.website) like $1 or lower(co.industry) like $1
        or lower(co.city) like $1 or exists (select 1 from unnest(co.tags) t where lower(t) like $1)
        or ($5 <> '' and regexp_replace(co.phone, '[^0-9]', '', 'g') like '%' || $5 || '%'))
      order by ${nameRank("lower(co.name)")}, lower(co.name) limit 5`, [...p, digits]),
    // Open projects before won and lost ones.
    query<SearchResults["projects"][number]>(`select o.id::int, o.name, coalesce(co.name, '') as company, o.stage, o.value_cents::float8 as value_cents
      from opportunities o left join companies co on co.id = o.company_id and co.deleted_at is null
      where o.deleted_at is null and (${nameHit("lower(o.name)")} or ${nameHit("lower(coalesce(co.name, ''))")})
      order by ${nameRank("lower(o.name)")}, o.stage in ('won', 'lost'), o.updated_at desc limit 5`, p),
    // Open to-dos first.
    query<SearchResults["todos"][number]>(`select t.id::int, t.title, t.done_at is not null as done, t.due::text,
        coalesce(nullif(trim(c.first_name || ' ' || c.last_name), ''), co.name, o.name) as about, c.id::int as contact_id, co.id::int as company_id, o.id::int as opportunity_id
      from todos t left join contacts c on c.id = t.contact_id and c.deleted_at is null left join companies co on co.id = t.company_id and co.deleted_at is null
        left join opportunities o on o.id = t.opportunity_id and o.deleted_at is null
      where t.deleted_at is null and ${nameHit("lower(t.title)")}
      order by t.done_at is not null, ${nameRank("lower(t.title)")}, t.due nulls last, t.id desc limit 5`, p),
    // Notes and logged calls, emails and meetings, newest first, on records that are still there.
    query<SearchResults["notes"][number]>(`select n.id::int, n.kind, n.body, coalesce(nullif(trim(c.first_name || ' ' || c.last_name), ''), co.name, o.name) as about,
        c.id::int as contact_id, co.id::int as company_id, o.id::int as opportunity_id
      from notes n left join contacts c on c.id = n.contact_id and c.deleted_at is null left join companies co on co.id = n.company_id and co.deleted_at is null
        left join opportunities o on o.id = n.opportunity_id and o.deleted_at is null
      where n.deleted_at is null and lower(n.body) like $1 and coalesce(c.id, co.id, o.id) is not null
      order by coalesce(n.happened_at, n.created_at) desc limit 5`, [p[0]]),
  ]);
  // A note shows the words around the match, not just its first line.
  const around = (body: string) => {
    const one = body.replace(/\s+/g, " ").trim(), at = one.toLowerCase().indexOf(q);
    if (at <= 40) return one;
    const space = one.lastIndexOf(" ", at - 20);
    return "…" + one.slice(space > at - 60 ? space + 1 : at - 20);
  };
  return {
    contacts: contacts.map((c) => ({ id: c.id, name: fullName(c), sub: c.sub })),
    companies, projects: projects.map((o) => ({ ...o, value_cents: Number(o.value_cents) })), todos,
    notes: notes.map((n) => ({ ...n, body: around(n.body) })),
  };
}

/** Recently Deleted: contacts, companies, notes and to-dos taken off in the last 30 days. */
export async function deletedItems() {
  return query<{ kind: string; id: number; title: string; sub: string; deleted_at: string }>(`
    select 'contact' as kind, id::int, trim(first_name || ' ' || last_name) as title, job_title as sub, ${iso("deleted_at")} as deleted_at, deleted_at as d from contacts where deleted_at > now() - interval '30 days'
    union all select 'company', id::int, name, industry, ${iso("deleted_at")}, deleted_at from companies where deleted_at > now() - interval '30 days'
    union all select 'note', id::int, left(body, 80), '', ${iso("deleted_at")}, deleted_at from notes where deleted_at > now() - interval '30 days'
    union all select 'todo', id::int, title, '', ${iso("deleted_at")}, deleted_at from todos where deleted_at > now() - interval '30 days'
    union all select 'opportunity', id::int, name, '', ${iso("deleted_at")}, deleted_at from opportunities where deleted_at > now() - interval '30 days'
    union all select 'campaign', id::int, name, '', ${iso("deleted_at")}, deleted_at from campaigns where deleted_at > now() - interval '30 days'
    union all select 'template', id::int, name, subject, ${iso("deleted_at")}, deleted_at from email_templates where deleted_at > now() - interval '30 days'
    order by d desc`);
}

// ---------------------------------------------------------------- leads (Docs section 4)
/** A lead points at a company or a person; its name and contact facts come from that record (one source of truth). */
export interface Lead {
  id: number; stage: string; priority: string; source: string; interested: string[]; owner_id: number | null; owner: string | null;
  stage_at: string; created_at: string; company_id: number | null; contact_id: number | null;
  name: string; sub: string; industry: string; city: string; next_follow_up: string | null;
}
const LEAD_SELECT = `select l.id::int, l.stage, l.priority, l.source, l.interested, l.owner_id::int, u.name as owner, ${iso("l.stage_at")} as stage_at, ${iso("l.created_at")} as created_at,
    l.company_id::int, l.contact_id::int,
    coalesce(co.name, nullif(trim(c.first_name || ' ' || c.last_name), '')) as name,
    case when co.id is not null then concat_ws(' · ', nullif(co.industry, ''), nullif(co.city, ''))
      else concat_ws(' · ', nullif(c.job_title, ''), (select x.name from contact_companies cc join companies x on x.id = cc.company_id where cc.contact_id = c.id limit 1)) end as sub,
    coalesce(co.industry, '') as industry, coalesce(co.city, c.city, '') as city, coalesce(co.next_follow_up, c.next_follow_up)::text as next_follow_up
  from leads l left join companies co on co.id = l.company_id and co.deleted_at is null left join contacts c on c.id = l.contact_id and c.deleted_at is null
    left join users u on u.id = l.owner_id
  where l.deleted_at is null and (co.id is not null or c.id is not null)`;
export type LeadSort = "priority" | "recent" | "name" | "follow_up";
export async function listLeads(o: { stage?: string; q?: string; priority?: string; industry?: string; city?: string; source?: string; owner?: number; sort?: LeadSort } = {}): Promise<Lead[]> {
  const where: string[] = [], p: unknown[] = [];
  const add = (sql: string, v: unknown) => { p.push(v); where.push(sql.replaceAll("$?", "$" + p.length)); };
  if (o.stage === "open") where.push("l.stage <> 'not_interested'"); else if (o.stage) add("l.stage = $?", o.stage);
  if (o.q?.trim()) add("lower(coalesce(co.name, '') || ' ' || coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '') || ' ' || coalesce(co.industry, '')) like $?", "%" + o.q.trim().toLowerCase() + "%");
  if (o.priority) add("l.priority = $?", o.priority);
  if (o.industry) add("co.industry = $?", o.industry);
  if (o.city) add("coalesce(co.city, c.city) = $?", o.city);
  if (o.source) add("l.source = $?", o.source);
  if (o.owner) add("l.owner_id = $?", o.owner);
  const order = { priority: "array_position(array['high','medium','low'], l.priority), l.stage_at desc, lower(coalesce(co.name, c.first_name))", recent: "l.created_at desc", name: "lower(coalesce(co.name, c.first_name))", follow_up: "coalesce(co.next_follow_up, c.next_follow_up) nulls last" }[o.sort ?? "priority"];
  return query<Lead>(`${LEAD_SELECT}${where.length ? " and " + where.join(" and ") : ""} order by ${order} limit 3000`, p);
}
export const leadFor = (o: { company?: number; contact?: number }) =>
  one<Lead>(`${LEAD_SELECT} and ${o.company ? "l.company_id" : "l.contact_id"} = $1`, [o.company ?? o.contact]);
export async function leadCounts(): Promise<Record<string, number>> {
  const rows = await query<{ stage: string; n: number }>(`select l.stage, count(*)::int as n from leads l left join companies co on co.id = l.company_id and co.deleted_at is null
    left join contacts c on c.id = l.contact_id and c.deleted_at is null where l.deleted_at is null and (co.id is not null or c.id is not null) group by l.stage`);
  return Object.fromEntries(rows.map((r) => [r.stage, r.n]));
}
export const leadSources = async () => (await query<{ s: string }>("select distinct source as s from leads where deleted_at is null and source <> '' order by 1")).map((r) => r.s);
export const leadCities = async () => (await query<{ c: string }>(`select distinct coalesce(co.city, c.city) as c from leads l left join companies co on co.id = l.company_id left join contacts c on c.id = l.contact_id
  where l.deleted_at is null and coalesce(co.city, c.city, '') <> '' order by 1`)).map((r) => r.c);

// ---------------------------------------------------------------- opportunities (Docs section 5)
export interface Opportunity {
  id: number; name: string; stage: string; value_cents: number; close_date: string | null; next_follow_up: string | null; position: number;
  stage_at: string; closed_at: string | null; created_at: string;
  company_id: number | null; company: string | null; contact_id: number | null; contact: string | null;
}
const OPP_SELECT = `select o.id::int, o.name, o.stage, o.value_cents::float8 as value_cents, o.close_date::text, o.next_follow_up::text, o.position, ${iso("o.stage_at")} as stage_at,
    ${iso("o.closed_at")} as closed_at, ${iso("o.created_at")} as created_at, o.company_id::int, co.name as company, o.contact_id::int,
    nullif(trim(c.first_name || ' ' || c.last_name), '') as contact
  from opportunities o left join companies co on co.id = o.company_id and co.deleted_at is null left join contacts c on c.id = o.contact_id and c.deleted_at is null
  where o.deleted_at is null`;
export async function listOpportunities(o: { q?: string; company?: number; contact?: number } = {}): Promise<Opportunity[]> {
  const where: string[] = [], p: unknown[] = [];
  if (o.q?.trim()) { p.push("%" + o.q.trim().toLowerCase() + "%"); where.push(`lower(o.name || ' ' || coalesce(co.name, '') || ' ' || coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) like $${p.length}`); }
  if (o.company) { p.push(o.company); where.push(`o.company_id = $${p.length}`); }
  if (o.contact) { p.push(o.contact); where.push(`o.contact_id = $${p.length}`); }
  return query<Opportunity>(`${OPP_SELECT}${where.length ? " and " + where.join(" and ") : ""} order by o.position, o.created_at desc limit 2000`, p);
}
export const opportunityById = cache((id: number) => one<Opportunity>(`${OPP_SELECT} and o.id = $1`, [id]));
export async function notesForOpportunity(id: number): Promise<Note[]> {
  return query<Note>(`select n.id::int, n.kind, n.body, u.name as author, ${iso("coalesce(n.happened_at, n.created_at)")} as created_at, (n.happened_at is not null) as day_only, n.contact_id::int, n.company_id::int, null as about
    from notes n left join users u on u.id = n.author_id where n.opportunity_id = $1 and n.deleted_at is null order by coalesce(n.happened_at, n.created_at) desc limit 300`, [id]);
}
export const todosForOpportunity = (id: number) =>
  query<Todo>(`select ${TODO_COLS} from ${TODO_FROM} where t.deleted_at is null and t.done_at is null and t.opportunity_id = $1 order by t.due nulls last, t.created_at`, [id]);
/** The Dashboard's and the Pipeline's sales line: open pipeline, won this month and this year, proposals waiting on an answer. */
export async function pipelineSummary() {
  // "This month" and "this year" start at midnight in Bakersfield.
  const start = (unit: string) => `(date_trunc('${unit}', now() at time zone '${TZ}') at time zone '${TZ}')`;
  return (await one<{ open_value: number; open_count: number; won_value: number; won_count: number; won_year_value: number; won_year_count: number; proposals: number }>(`select
    coalesce(sum(value_cents) filter (where stage in ('lead','meeting','proposal_sent','negotiating')), 0)::float8 as open_value,
    count(*) filter (where stage in ('lead','meeting','proposal_sent','negotiating'))::int as open_count,
    coalesce(sum(value_cents) filter (where stage = 'won' and closed_at >= ${start("month")}), 0)::float8 as won_value,
    count(*) filter (where stage = 'won' and closed_at >= ${start("month")})::int as won_count,
    coalesce(sum(value_cents) filter (where stage = 'won' and closed_at >= ${start("year")}), 0)::float8 as won_year_value,
    count(*) filter (where stage = 'won' and closed_at >= ${start("year")})::int as won_year_count,
    count(*) filter (where stage = 'proposal_sent')::int as proposals
    from opportunities where deleted_at is null`))!;
}

// ---------------------------------------------------------------- activities and the network (Docs sections 6 and 7)
export interface Activity extends Note { company: string | null; project: string | null; opportunity_id: number | null }
/** Every call, email, meeting, note… across the Rolodex, newest first (Activities page). */
export async function listActivities(o: { kind?: string; author?: number; q?: string; days?: number } = {}): Promise<Activity[]> {
  const where = ["n.deleted_at is null", "(c.id is null or c.deleted_at is null)", "(co.id is null or co.deleted_at is null)"], p: unknown[] = [];
  if (o.kind === "interactions") where.push("n.kind in ('call','email','text','meeting','video','linkedin','introduction')");
  else if (o.kind) { p.push(o.kind); where.push(`n.kind = $${p.length}`); }
  if (o.author) { p.push(o.author); where.push(`n.author_id = $${p.length}`); }
  if (o.q?.trim()) { p.push("%" + o.q.trim().toLowerCase() + "%"); where.push(`lower(n.body || ' ' || coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '') || ' ' || coalesce(co.name, '')) like $${p.length}`); }
  if (o.days) { p.push(o.days); where.push(`coalesce(n.happened_at, n.created_at) > now() - ($${p.length}::int * interval '1 day')`); }
  return query<Activity>(`select n.id::int, n.kind, n.body, u.name as author, ${iso("coalesce(n.happened_at, n.created_at)")} as created_at, (n.happened_at is not null) as day_only, n.contact_id::int, n.company_id::int, n.opportunity_id::int,
      nullif(trim(c.first_name || ' ' || c.last_name), '') as about, co.name as company, o.name as project
    from notes n left join users u on u.id = n.author_id left join contacts c on c.id = n.contact_id left join companies co on co.id = n.company_id
      left join opportunities o on o.id = n.opportunity_id and o.deleted_at is null
    where ${where.join(" and ")} order by coalesce(n.happened_at, n.created_at) desc limit 500`, p);
}

export interface Relation { id: number; kind: string; note: string; other_id: number; other: string; other_sub: string; outgoing: boolean }
/** Who this person knows (Relationships card). `outgoing`: they introduced or referred the other person. */
export async function relationshipsFor(contact: number): Promise<Relation[]> {
  return query<Relation>(`select r.id::int, r.kind, r.note, o.id::int as other_id, trim(o.first_name || ' ' || o.last_name) as other,
      concat_ws(' · ', nullif(o.job_title, ''), (select co.name from contact_companies cc join companies co on co.id = cc.company_id where cc.contact_id = o.id limit 1)) as other_sub,
      r.contact_id = $1 as outgoing
    from relationships r join contacts o on o.id = case when r.contact_id = $1 then r.other_id else r.contact_id end and o.deleted_at is null
    where r.deleted_at is null and (r.contact_id = $1 or r.other_id = $1) order by lower(o.first_name)`, [contact]);
}

/**
 * The Network page's question (Docs example: "Derek introduces you to Brian… shows whether it generates opportunities"):
 * for everyone who brought people to Collins Creative (contacts.introduced_by, or an "introduced"/"referred" link),
 * how many people, and the projects those people's companies have (open and won).
 */
export interface Connector { id: number; name: string; sub: string; people: number; open_value: number; won_value: number; projects: number }
export async function connectors(): Promise<Connector[]> {
  return query<Connector>(`with brought as (
      select introduced_by as by, id as person from contacts where introduced_by is not null and deleted_at is null
      union select contact_id, other_id from relationships where kind in ('introduced', 'referred') and deleted_at is null
    ), their_projects as (
      select distinct b.by, o.id, o.stage, o.value_cents from brought b
        join opportunities o on o.deleted_at is null and (o.contact_id = b.person or o.company_id in (select company_id from contact_companies where contact_id = b.person))
    )
    select c.id::int, trim(c.first_name || ' ' || c.last_name) as name, concat_ws(' · ', nullif(c.job_title, ''), (select co.name from contact_companies cc join companies co on co.id = cc.company_id where cc.contact_id = c.id limit 1)) as sub,
      (select count(distinct person)::int from brought where by = c.id) as people,
      coalesce((select sum(value_cents) from their_projects p where p.by = c.id and p.stage in ('lead','meeting','proposal_sent','negotiating')), 0)::float8 as open_value,
      coalesce((select sum(value_cents) from their_projects p where p.by = c.id and p.stage = 'won'), 0)::float8 as won_value,
      (select count(*)::int from their_projects p where p.by = c.id) as projects
    from contacts c where c.deleted_at is null and exists (select 1 from brought where by = c.id)
    order by won_value desc, open_value desc, people desc, lower(c.first_name)`);
}
/** Referral partners: people marked as such, with how many they've brought. */
export async function referralPartners() {
  return query<{ id: number; name: string; sub: string; people: number }>(`select c.id::int, trim(c.first_name || ' ' || c.last_name) as name,
      concat_ws(' · ', nullif(c.job_title, ''), (select co.name from contact_companies cc join companies co on co.id = cc.company_id where cc.contact_id = c.id limit 1)) as sub,
      (select count(*)::int from contacts x where x.introduced_by = c.id and x.deleted_at is null) as people
    from contacts c where c.deleted_at is null and 'referral_partner' = any(c.kinds) order by lower(c.first_name)`);
}

// ---------------------------------------------------------------- outreach (Docs section 8; send-only)
export interface Template { id: number; name: string; subject: string; body: string }
export const templates = () => query<Template>("select id::int, name, subject, body from email_templates where deleted_at is null order by lower(name)");

export interface Campaign { id: number; name: string; subject: string; body: string; created_at: string; people: number; to_send: number; sent: number; replied: number; follow_up: number }
const CAMPAIGN_COLS = `c.id::int, c.name, c.subject, c.body, ${iso("c.created_at")} as created_at,
  (select count(*)::int from campaign_people p where p.campaign_id = c.id) as people,
  (select count(*)::int from campaign_people p where p.campaign_id = c.id and p.status = 'to_send') as to_send,
  (select count(*)::int from campaign_people p where p.campaign_id = c.id and p.status in ('sent','replied','follow_up','not_interested')) as sent,
  (select count(*)::int from campaign_people p where p.campaign_id = c.id and p.status = 'replied') as replied,
  (select count(*)::int from campaign_people p where p.campaign_id = c.id and p.status = 'follow_up') as follow_up`;
export const listCampaigns = () => query<Campaign>(`select ${CAMPAIGN_COLS} from campaigns c where c.deleted_at is null order by c.created_at desc`);
export const campaignById = (id: number) => one<Campaign>(`select ${CAMPAIGN_COLS} from campaigns c where c.id = $1 and c.deleted_at is null`, [id]);
/** Who's on a campaign's list: their address (a person's first email, else the company's) and where they stand. */
export interface CampaignPerson { contact_id: number | null; company_id: number | null; name: string; sub: string; email: string; status: string; status_at: string }
export async function campaignPeople(id: number): Promise<CampaignPerson[]> {
  return query<CampaignPerson>(`select p.contact_id::int, p.company_id::int,
      coalesce(nullif(trim(c.first_name || ' ' || c.last_name), ''), co.name) as name,
      coalesce(case when c.id is not null then concat_ws(' · ', nullif(c.job_title, ''), (select x.name from contact_companies cc join companies x on x.id = cc.company_id where cc.contact_id = c.id limit 1)) end, co.industry, '') as sub,
      coalesce(c.emails -> 0 ->> 'value', co.email, '') as email, p.status, ${iso("p.status_at")} as status_at
    from campaign_people p left join contacts c on c.id = p.contact_id left join companies co on co.id = p.company_id
    where p.campaign_id = $1 and (c.id is null or c.deleted_at is null) and (co.id is null or co.deleted_at is null)
    order by array_position(array['replied','follow_up','to_send','sent','not_interested','skipped'], p.status), lower(coalesce(c.first_name, co.name))`, [id]);
}

export interface SentEmail { id: number; to_email: string; subject: string; body: string; status: string; error: string; sent_at: string; sender: string | null; contact_id: number | null; company_id: number | null; who: string | null; campaign: string | null }
/** Emails Rolodex sent, newest first (one person or company, or everyone). */
export async function sentEmails(o: { contact?: number; company?: number; limit?: number } = {}): Promise<SentEmail[]> {
  const where = ["true"], p: unknown[] = [];
  if (o.contact) { p.push(o.contact); where.push(`e.contact_id = $${p.length}`); }
  if (o.company) { p.push(o.company); where.push(`e.company_id = $${p.length}`); }
  p.push(o.limit ?? 100);
  return query<SentEmail>(`select e.id::int, e.to_email, e.subject, e.body, e.status, e.error, ${iso("e.sent_at")} as sent_at, u.name as sender, e.contact_id::int, e.company_id::int,
      coalesce(nullif(trim(c.first_name || ' ' || c.last_name), ''), co.name) as who, k.name as campaign
    from emails e left join users u on u.id = e.sent_by left join contacts c on c.id = e.contact_id left join companies co on co.id = e.company_id left join campaigns k on k.id = e.campaign_id
    where ${where.join(" and ")} order by e.sent_at desc limit $${p.length}`, p);
}
/** Who a campaign can go to, for its "add people" picker: everyone with an email, with their tags and lead stage. */
export async function reachable() {
  return query<{ kind: "contact" | "company"; id: number; name: string; sub: string; email: string; tags: string[]; lead_stage: string | null }>(`
    select 'contact' as kind, c.id::int, trim(c.first_name || ' ' || c.last_name) as name, c.job_title as sub, c.emails -> 0 ->> 'value' as email, c.tags,
      (select stage from leads l where l.contact_id = c.id and l.deleted_at is null) as lead_stage
    from contacts c where c.deleted_at is null and jsonb_array_length(c.emails) > 0
    union all
    select 'company', co.id::int, co.name, co.industry, co.email, co.tags, (select stage from leads l where l.company_id = co.id and l.deleted_at is null)
    from companies co where co.deleted_at is null and co.email <> ''
    order by 3`);
}

// ---------------------------------------------------------------- follow-ups (Brendan 10-15: one of the three core features)
/**
 * Every follow-up, whatever it's on: a person (their follow-up date, or their keep-in-touch rhythm coming due), a
 * company, or an open project. Late first, then today's, then people out of touch longest, then what's coming up.
 * `ahead` days of upcoming ones are included (0 = only what's due today or late).
 */
export interface FollowUpItem {
  type: "contact" | "company" | "project"; id: number; name: string; sub: string; href: string;
  due: string; tone: "late" | "due" | "soon"; why: string; touch: boolean; keep_in_touch: number | null; contact_id: number | null; contact: string | null;
  /** Who to call, text or email about it: the person, the company's main line, or a project's main contact. */
  phones: Labeled[]; emails: Labeled[]; company_id: number | null;
}
/** How many follow-ups are due today or late (the same rules as followUps()), as one SQL expression: the sidebar's count. */
export const FOLLOWUPS_DUE_SQL = `((select count(*)::int from contacts c where c.deleted_at is null and (c.next_follow_up <= ${TODAY_SQL}
    or (c.next_follow_up is null and c.keep_in_touch is not null and coalesce(c.last_contacted + c.keep_in_touch, ${TODAY_SQL}) <= ${TODAY_SQL})))
  + (select count(*)::int from companies where deleted_at is null and next_follow_up <= ${TODAY_SQL})
  + (select count(*)::int from opportunities where deleted_at is null and next_follow_up <= ${TODAY_SQL} and stage in ('lead','meeting','proposal_sent','negotiating')))`;
/** A company's single phone or email as a labeled list. */
const main = (v: string | null | undefined): Labeled[] => (v?.trim() ? [{ label: "Main", value: v.trim() }] : []);
export async function followUps(ahead = 0): Promise<FollowUpItem[]> {
  const t = today(), until = addDays(t, ahead);
  const [people, companies, projects] = await Promise.all([
    query<{ id: number; name: string; job_title: string; company: string | null; next_follow_up: string | null; last_contacted: string | null; keep_in_touch: number | null; phones: Labeled[]; emails: Labeled[] }>(`
      select c.id::int, trim(c.first_name || ' ' || c.last_name) as name, c.job_title, c.next_follow_up::text, c.last_contacted::text, c.keep_in_touch, c.phones, c.emails,
        (select co.name from contact_companies cc join companies co on co.id = cc.company_id and co.deleted_at is null where cc.contact_id = c.id order by co.name limit 1) as company
      from contacts c where c.deleted_at is null and (c.next_follow_up <= $1::date
        or (c.next_follow_up is null and c.keep_in_touch is not null and coalesce(c.last_contacted + c.keep_in_touch, ${TODAY_SQL}) <= $1::date))`, [until]),
    query<{ id: number; name: string; industry: string; city: string; next_follow_up: string; phone: string; email: string }>(`select id::int, name, industry, city, next_follow_up::text, phone, email
      from companies where deleted_at is null and next_follow_up <= $1::date`, [until]),
    query<{ id: number; name: string; next_follow_up: string; stage: string; value_cents: number; company: string | null; contact_id: number | null; contact: string | null; company_id: number | null; phones: Labeled[] | null; emails: Labeled[] | null; co_phone: string | null; co_email: string | null }>(`
      select o.id::int, o.name, o.next_follow_up::text, o.stage, o.value_cents::float8 as value_cents, co.name as company, o.contact_id::int,
        o.company_id::int, c.phones, c.emails, co.phone as co_phone, co.email as co_email,
        nullif(trim(c.first_name || ' ' || c.last_name), '') as contact
      from opportunities o left join companies co on co.id = o.company_id and co.deleted_at is null left join contacts c on c.id = o.contact_id and c.deleted_at is null
      where o.deleted_at is null and o.next_follow_up <= $1::date and o.stage in ('lead','meeting','proposal_sent','negotiating')`, [until]),
  ]);
  const tone = (due: string): FollowUpItem["tone"] => (due < t ? "late" : due === t ? "due" : "soon");
  const said = (due: string) => {
    const n = daysBetween(due, t);
    return n > 0 ? "Follow-up " + n + (n === 1 ? " day late" : " days late") : n === 0 ? "Follow-up today" : "Follow-up " + (n === -1 ? "tomorrow" : "in " + -n + " days");
  };
  const out: FollowUpItem[] = [];
  for (const c of people) {
    const touch = !c.next_follow_up, due = c.next_follow_up ?? (c.last_contacted ? addDays(c.last_contacted, c.keep_in_touch!) : t);
    const since = c.last_contacted ? daysBetween(c.last_contacted, t) : null;
    const why = !touch ? said(due) : since === null ? "Keep in touch · no touch logged yet" : due <= t ? "Last in touch " + since + " days ago" : "Reconnect " + (daysBetween(t, due) === 1 ? "tomorrow" : "in " + daysBetween(t, due) + " days");
    out.push({ type: "contact", id: c.id, name: c.name, sub: [c.job_title, c.company].filter(Boolean).join(" at "), href: "/contacts/" + c.id, due, tone: tone(due), why, touch, keep_in_touch: c.keep_in_touch, contact_id: c.id, contact: c.name, phones: c.phones, emails: c.emails, company_id: null });
  }
  for (const co of companies)
    out.push({ type: "company", id: co.id, name: co.name, sub: [co.industry, co.city].filter(Boolean).join(" · "), href: "/companies/" + co.id, due: co.next_follow_up, tone: tone(co.next_follow_up), why: said(co.next_follow_up), touch: false, keep_in_touch: null, contact_id: null, contact: null, phones: main(co.phone), emails: main(co.email), company_id: co.id });
  for (const o of projects)
    out.push({ type: "project", id: o.id, name: o.name, sub: [o.company, o.contact].filter(Boolean).join(" · "), href: "/pipeline/" + o.id, due: o.next_follow_up, tone: tone(o.next_follow_up), why: said(o.next_follow_up), touch: false, keep_in_touch: null, contact_id: o.contact_id, contact: o.contact,
      phones: o.phones?.length ? o.phones : main(o.co_phone), emails: o.emails?.length ? o.emails : main(o.co_email), company_id: o.company_id });
  // Due ones by date (oldest first), people's follow-ups before keep-in-touch reminders on the same day; then upcoming.
  return out.sort((a, b) => a.due.localeCompare(b.due) || Number(a.touch) - Number(b.touch) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- duplicates (Brendan: "we do not want any duplicate stuff in this software")
/** A company name boiled down for matching: lower case, no legal ending, letters and digits only. */
export const SAME_NAME = (x: string) => `regexp_replace(regexp_replace(lower(${x}), '\\m(incorporated|inc|llc|l l c|ltd|limited|co|corp|corporation|company|pllc|llp|lp)\\M\\.?', '', 'g'), '[^a-z0-9]', '', 'g')`;
/** A website boiled down to its domain: no scheme, no www, no path. */
const SAME_SITE = (x: string) => `regexp_replace(regexp_replace(lower(${x}), '^(https?://)?(www\\.)?', ''), '[/?#].*$', '')`;
export interface Duplicate { id: number; name: string; sub: string; href: string; why: string }
/**
 * Records that look like the one being added: a person with the same name, email or phone; a company with the same
 * name (ignoring Inc/LLC and punctuation) or website. `not` leaves out the record being edited.
 */
export async function possibleDuplicates(o: { type: "contact"; first?: string; last?: string; emails?: string[]; phones?: string[]; not?: number } | { type: "company"; name?: string; website?: string; not?: number }): Promise<Duplicate[]> {
  if (o.type === "company") {
    const name = (o.name ?? "").trim(), site = (o.website ?? "").trim();
    if (!name && !site) return [];
    return query<Duplicate>(`select id::int, name, concat_ws(' · ', nullif(industry, ''), nullif(city, '')) as sub, '/companies/' || id as href,
        case when $1 <> '' and ${SAME_NAME("name")} = ${SAME_NAME("$1")} then 'Same name' else 'Same website' end as why
      from companies where deleted_at is null and id <> coalesce($3::bigint, 0) and (
        ($1 <> '' and ${SAME_NAME("$1")} <> '' and ${SAME_NAME("name")} = ${SAME_NAME("$1")})
        or ($2 <> '' and website <> '' and ${SAME_SITE("website")} = ${SAME_SITE("$2")}))
      order by lower(name) limit 5`, [name, site, o.not ?? null]);
  }
  const full = [o.first, o.last].map((x) => (x ?? "").trim()).filter(Boolean).join(" ").toLowerCase();
  const emails = (o.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const phones = (o.phones ?? []).map((p) => p.replace(/\D/g, "").slice(-10)).filter((p) => p.length >= 7);
  if (!full && !emails.length && !phones.length) return [];
  return query<Duplicate>(`select c.id::int, trim(c.first_name || ' ' || c.last_name) as name, '/contacts/' || c.id as href,
      concat_ws(' · ', nullif(c.job_title, ''), (select co.name from contact_companies cc join companies co on co.id = cc.company_id where cc.contact_id = c.id limit 1)) as sub,
      case when $1 <> '' and lower(trim(c.first_name || ' ' || c.last_name)) = $1 then 'Same name'
        when exists (select 1 from jsonb_array_elements(c.emails) e where lower(e->>'value') = any($2::text[])) then 'Same email' else 'Same phone' end as why
    from contacts c where c.deleted_at is null and c.id <> coalesce($4::bigint, 0) and (
      ($1 <> '' and lower(trim(c.first_name || ' ' || c.last_name)) = $1)
      or exists (select 1 from jsonb_array_elements(c.emails) e where lower(e->>'value') = any($2::text[]))
      or exists (select 1 from jsonb_array_elements(c.phones) p where right(regexp_replace(p->>'value', '\\D', '', 'g'), 10) = any($3::text[])))
    order by lower(c.first_name) limit 5`, [full, emails, phones, o.not ?? null]);
}
