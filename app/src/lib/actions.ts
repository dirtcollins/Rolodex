import "server-only";
import { query, one, transaction } from "./db";
import { accountProblem, hashPassword, MIN_PASSWORD, userByEmail, type Session } from "./auth";
import { ACTIVITY_KINDS, INTERACTIONS, KINDS, LEAD_STAGES, OPP_STAGES, RELATION_KINDS, fullName, today } from "./format";
import { fill, looksLikeEmail, sendEmail } from "./email";
import { SAME_NAME, possibleDuplicates } from "./data";
import { PURGE_KINDS, purgeDeletedSnapshot, type DeletedSnapshotItem } from "./purge-deleted";

// Every change Rolodex makes, by name. The browser posts { action, data } to /api/save (one plain address, not
// server actions: Light Ops learned that a page opened before an update can't call those afterwards).
// Each answers { ok: true, id? } or throws a Problem with words for the person.

export class Problem extends Error {}
type Data = Record<string, unknown>;
type Action = (d: Data, s: Session) => Promise<{ id?: number; ids?: number[]; [more: string]: unknown } | void>;

// ---------------------------------------------------------------- reading what the browser sent
const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const text = (v: unknown) => str(v, 20000);
const int = (v: unknown) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const date = (v: unknown) => { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null; };
const list = (v: unknown, max = 40) => [...new Set((Array.isArray(v) ? v : String(v ?? "").split(",")).map((x) => str(x, 60)).filter(Boolean))].slice(0, max);
const labeled = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => ({ label: str((x as Data)?.label, 30), value: str((x as Data)?.value, 200) })).filter((x) => x.value).slice(0, 8);
const need = <T,>(v: T | null, what: string): T => { if (v === null) throw new Problem(what); return v; };
const owner = (s: Session) => { if (s.user.role !== "owner") throw new Problem("Only an owner can change that."); };

/** What can be deleted and brought back, by the name the screens use. */
const TABLES: Record<string, string> = { contact: "contacts", company: "companies", note: "notes", todo: "todos", opportunity: "opportunities", lead: "leads",
  relationship: "relationships", campaign: "campaigns", template: "email_templates" };
/** One id or a list of them. */
const ids = (d: Data, what: string) => {
  const many = Array.isArray(d.ids) ? d.ids.map(int).filter((x): x is number => !!x).slice(0, 5000) : [int(d.id)].filter((x): x is number => !!x);
  if (!many.length) throw new Problem(what);
  return many;
};
/** A follow-up lives on a person, a company or a project. */
const followTarget = (d: Data) => {
  const table = ({ contact: "contacts", company: "companies", project: "opportunities", opportunity: "opportunities" } as Record<string, string>)[String(d.type)];
  if (!table) throw new Problem("Pick who to follow up with.");
  return { table, id: need(int(d.id), "Pick who to follow up with.") };
};

// ---------------------------------------------------------------- contacts
const CONTACT_FIELDS = (d: Data) => {
  const first = str(d.first_name, 80), last = str(d.last_name, 80);
  if (!first && !last) throw new Problem("Add a name.");
  const kinds = list(d.kinds).filter((k) => KINDS.some(([v]) => v === k));
  const keep = int(d.keep_in_touch);
  return [first, last, str(d.job_title, 120), kinds, list(d.tags), JSON.stringify(labeled(d.phones)), JSON.stringify(labeled(d.emails)),
    str(d.website, 300), str(d.linkedin, 300), text(d.socials).slice(0, 2000), str(d.city, 80), str(d.state, 40), date(d.birthday), text(d.how_met).slice(0, 2000),
    int(d.introduced_by), int(d.owner_id), date(d.next_follow_up), keep && [30, 60, 90, 180].includes(keep) ? keep : null];
};

/** A company named in the contact form: an existing one by id, or a new one by name. */
async function companyFor(tx: { query: typeof query }, v: Data, s: Session): Promise<number | null> {
  const id = int(v.id);
  if (id) return id;
  const name = str(v.name, 160);
  if (!name) return null;
  // No duplicates (Brendan, 2026-10-15): "ABC Construction" is "ABC Construction, Inc." — case, punctuation and the legal
  // ending (Inc, LLC, Ltd, Co, Corp) don't make a different company.
  const found = (await tx.query<{ id: number }>(`select id::int from companies where deleted_at is null and ${SAME_NAME("name")} = ${SAME_NAME("$1")} limit 1`, [name]))[0];
  if (found) return found.id;
  return (await tx.query<{ id: number }>("insert into companies (name, created_by) values ($1, $2) returning id::int", [name, s.user.id]))[0].id;
}

/**
 * Money typed by a person: "$12,500", "12500.50", "35k", "1.2M". Blank is no value; anything else is a problem, not a
 * silent $0.
 */
const dollars = (v: unknown) => {
  const t = str(v, 40).replace(/[$,\s]/g, "").toLowerCase();
  if (!t) return 0;
  const m = /^(\d+(?:\.\d+)?|\.\d+)([km]?)$/.exec(t);
  if (!m) throw new Problem("Type the value in dollars, like 12,500.");
  const cents = Math.round(Number(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1) * 100);
  if (cents > 1e13) throw new Problem("That value is too large.");
  return cents;
};
/** A project's stage changing to `to`: when it entered the stage, and when and by whom (`by`, for the bell) it was won or lost (kept while it stays won or lost). */
const STAGE_CHANGE = (to: string, by: string) => `stage_at = case when stage <> ${to} then now() else stage_at end,
  closed_at = case when ${to} in ('won','lost') then (case when stage = ${to} then coalesce(closed_at, now()) else now() end) end,
  closed_by = case when ${to} in ('won','lost') then (case when stage = ${to} then closed_by else ${by}::bigint end) end`;
/** The place above the first card in a stage. */
const TOP_OF = (stage: string) => `(select coalesce(min(position), 1) - 1 from opportunities where stage = ${stage} and deleted_at is null)`;

const actions: Record<string, Action> = {
  "contact.save": async (d, s) => {
    const f = CONTACT_FIELDS(d), id = int(d.id);
    // No duplicates (Brendan 10-15): the form warns first and sends allow_duplicate when he chose "Add anyway".
    // Asked before the transaction: possibleDuplicates uses its own query, and on PGlite's one connection a query
    // inside a transaction waits for the transaction forever (the whole server froze).
    if (!id && d.allow_duplicate !== true) {
      const same = await possibleDuplicates({ type: "contact", first: f[0] as string, last: f[1] as string, emails: labeled(d.emails).map((e) => e.value), phones: labeled(d.phones).map((p) => p.value) });
      if (same.length) throw new Problem(same[0].name + " is already in Rolodex (" + same[0].why.toLowerCase() + ").");
    }
    return transaction(async (tx) => {
      const q = (sql: string, p: unknown[] = []) => tx.query(sql, p) as never;
      let cid = id;
      if (cid) {
        if (cid === f[14]) throw new Problem("Someone can’t introduce themselves.");
        await q(`update contacts set first_name=$2, last_name=$3, job_title=$4, kinds=$5, tags=$6, phones=$7::text::jsonb, emails=$8::text::jsonb, website=$9,
          linkedin=$10, socials=$11, city=$12, state=$13, birthday=$14, how_met=$15, introduced_by=$16, owner_id=$17, next_follow_up=$18, keep_in_touch=$19,
          updated_at=now() where id=$1 and deleted_at is null`, [cid, ...f]);
      } else {
        cid = ((await tx.query(`insert into contacts (first_name, last_name, job_title, kinds, tags, phones, emails, website, linkedin, socials, city, state, birthday,
          how_met, introduced_by, owner_id, next_follow_up, keep_in_touch, created_by) values ($1,$2,$3,$4,$5,$6::text::jsonb,$7::text::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          returning id::int`, [...f, s.user.id]))[0] as { id: number }).id;
      }
      // Their companies, when the form sends them (a full list: what's left out is unlinked, never deleted).
      let primaryCompany: number | null = null;
      if (Array.isArray(d.companies)) {
        const keep: number[] = [];
        for (const v of (d.companies as Data[]).slice(0, 10)) {
          const co = await companyFor(tx as never, v, s);
          if (!co) continue;
          primaryCompany ??= co;
          keep.push(co);
          await q("insert into contact_companies (contact_id, company_id, title) values ($1, $2, $3) on conflict (contact_id, company_id) do update set title = excluded.title", [cid, co, str(v.title, 120)]);
        }
        await q("delete from contact_companies where contact_id = $1 and not (company_id = any($2::bigint[]))", [cid, keep]);
      }
      return { id: cid!, companyId: primaryCompany };
    });
  },
  /** Log a touch: we were in touch today. A note can go with it; a due follow-up is done (or moves to the new date). */
  "contact.touch": async (d, s) => {
    const id = need(int(d.id), "Pick a contact."), body = text(d.note), kind = INTERACTIONS.includes(String(d.kind)) ? String(d.kind) : "note";
    await transaction(async (tx) => {
      await tx.query("update contacts set last_contacted = $2, next_follow_up = $3, updated_at = now() where id = $1", [id, today(), date(d.next_follow_up)]);
      // How it happened (a call, an email…) goes with the note, so the history reads "Call · Today".
      if (body) await tx.query("insert into notes (contact_id, body, author_id, kind) values ($1, $2, $3, $4)", [id, body, s.user.id, kind]);
    });
  },
  "contact.follow_up": async (d) => { await query("update contacts set next_follow_up = $2, updated_at = now() where id = $1", [need(int(d.id), "Pick a contact."), date(d.date)]); },
  "contact.delete": async (d) => {
    // One, or many at once (a list cleanup); all go to Recently Deleted.
    const ids = Array.isArray(d.ids) ? d.ids.map(int).filter((x): x is number => !!x).slice(0, 5000) : [need(int(d.id), "Pick a contact.")];
    await query("update contacts set deleted_at = now() where id = any($1::bigint[]) and deleted_at is null", [ids]);
  },
  /**
   * Two records for one person (no duplicates): everything on `from` moves to `into` (notes, to-dos, companies,
   * connections, projects, leads, campaign lists, emails, the people they introduced), details `into` is missing are
   * filled in from `from`, then `from` goes to Recently Deleted.
   */
  "contact.merge": async (d) => {
    const from = need(int(d.from), "Pick the contact to merge."), into = need(int(d.into), "Pick the contact to keep.");
    if (from === into) throw new Problem("Pick two different people.");
    await transaction(async (tx) => {
      if ((await tx.query("select id from contacts where id = any($1::bigint[]) and deleted_at is null", [[from, into]])).length < 2) throw new Problem("One of them was just deleted. Refresh and try again.");
      // Their companies: a company both are at keeps the kept person's role (or the other's, when that's blank).
      await tx.query(`insert into contact_companies (contact_id, company_id, title) select $2, company_id, title from contact_companies where contact_id = $1
        on conflict (contact_id, company_id) do update set title = coalesce(nullif(contact_companies.title, ''), excluded.title)`, [from, into]);
      await tx.query("delete from contact_companies where contact_id = $1", [from]);
      for (const t of ["notes", "todos", "opportunities", "emails"]) await tx.query(`update ${t} set contact_id = $2 where contact_id = $1`, [from, into]);
      // One lead per person: the kept one's stays; otherwise the merged one's moves over.
      await tx.query("update leads set contact_id = $2 where contact_id = $1 and deleted_at is null and not exists (select 1 from leads where contact_id = $2 and deleted_at is null)", [from, into]);
      await tx.query("update leads set deleted_at = now() where contact_id = $1 and deleted_at is null", [from]);
      // On each campaign list once.
      await tx.query("update campaign_people p set contact_id = $2 where p.contact_id = $1 and not exists (select 1 from campaign_people x where x.campaign_id = p.campaign_id and x.contact_id = $2)", [from, into]);
      await tx.query("delete from campaign_people where contact_id = $1", [from]);
      // Who they know: a connection between the two goes, and one the kept person already has isn't doubled.
      await tx.query("update relationships set deleted_at = now() where deleted_at is null and ((contact_id = $1 and other_id = $2) or (contact_id = $2 and other_id = $1))", [from, into]);
      await tx.query(`update relationships r set deleted_at = now() where r.deleted_at is null and (r.contact_id = $1 or r.other_id = $1) and exists (
          select 1 from relationships x where x.deleted_at is null and x.kind = r.kind and (x.contact_id = $2 or x.other_id = $2)
            and (case when x.contact_id = $2 then x.other_id else x.contact_id end) = (case when r.contact_id = $1 then r.other_id else r.contact_id end))`, [from, into]);
      await tx.query("update relationships set contact_id = $2 where contact_id = $1 and other_id <> $2", [from, into]);
      await tx.query("update relationships set other_id = $2 where other_id = $1 and contact_id <> $2", [from, into]);
      await tx.query("update contacts set introduced_by = $2 where introduced_by = $1 and id <> $2", [from, into]);
      // Details the kept one is missing come from the merged one; emails, phones, kinds and tags join (each once).
      const joined = (list: string, key: string) => `(select coalesce(jsonb_agg(e order by n), '[]'::jsonb) from (select distinct on (${key}) e, n
        from jsonb_array_elements(${list}) with ordinality as t(e, n) order by ${key}, n) d)`;
      await tx.query(`update contacts k set job_title = coalesce(nullif(k.job_title, ''), f.job_title), website = coalesce(nullif(k.website, ''), f.website),
          linkedin = coalesce(nullif(k.linkedin, ''), f.linkedin), socials = coalesce(nullif(k.socials, ''), f.socials), city = coalesce(nullif(k.city, ''), f.city),
          state = coalesce(nullif(k.state, ''), f.state), how_met = coalesce(nullif(k.how_met, ''), f.how_met), birthday = coalesce(k.birthday, f.birthday),
          introduced_by = case when k.introduced_by = f.id then nullif(f.introduced_by, k.id) else coalesce(k.introduced_by, nullif(f.introduced_by, k.id)) end,
          owner_id = coalesce(k.owner_id, f.owner_id), keep_in_touch = coalesce(k.keep_in_touch, f.keep_in_touch),
          next_follow_up = least(k.next_follow_up, f.next_follow_up), last_contacted = greatest(k.last_contacted, f.last_contacted),
          kinds = array(select distinct unnest(k.kinds || f.kinds)), tags = array(select distinct unnest(k.tags || f.tags)),
          emails = ${joined("k.emails || f.emails", "lower(e->>'value')")},
          phones = ${joined("k.phones || f.phones", "right(regexp_replace(e->>'value', '\\D', '', 'g'), 10)")}, updated_at = now()
        from contacts f where k.id = $2 and f.id = $1`, [from, into]);
      await tx.query("update contacts set deleted_at = now() where id = $1", [from]);
    });
    return { id: into };
  },

  // ---------------------------------------------------------------- companies
  "company.save": async (d, s) => {
    const name = str(d.name, 160);
    if (!name) throw new Problem("Add the company’s name.");
    const f = [name, str(d.industry, 80), text(d.description).slice(0, 4000), str(d.website, 300), str(d.phone, 40), str(d.email, 200), str(d.street, 160),
      str(d.city, 80), str(d.state, 40), str(d.zip, 20), str(d.linkedin, 300), text(d.socials).slice(0, 2000), str(d.size, 40), str(d.revenue, 60), text(d.tech).slice(0, 2000),
      list(d.needs), list(d.tags), int(d.owner_id), date(d.next_follow_up)];
    const id = int(d.id);
    if (id) {
      await query(`update companies set name=$2, industry=$3, description=$4, website=$5, phone=$6, email=$7, street=$8, city=$9, state=$10, zip=$11, linkedin=$12,
        socials=$13, size=$14, revenue=$15, tech=$16, needs=$17, tags=$18, owner_id=$19, next_follow_up=$20, updated_at=now() where id=$1 and deleted_at is null`, [id, ...f]);
      return { id };
    }
    if (d.allow_duplicate !== true) {
      const same = await possibleDuplicates({ type: "company", name, website: str(d.website, 300) });
      if (same.length) throw new Problem(same[0].name + " is already in Rolodex (" + same[0].why.toLowerCase() + ").");
    }
    return one<{ id: number }>(`insert into companies (name, industry, description, website, phone, email, street, city, state, zip, linkedin, socials, size, revenue, tech,
      needs, tags, owner_id, next_follow_up, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) returning id::int`, [...f, s.user.id]) as never;
  },
  /** Only the fields sent (filling in a website or city found later), the rest untouched. */
  "company.patch": async (d) => {
    const id = need(int(d.id), "Pick a company.");
    const MAX: Record<string, number> = { website: 300, phone: 40, email: 200, street: 160, city: 80, state: 40, zip: 20, industry: 80, linkedin: 300, size: 40, revenue: 60 };
    const keys = Object.keys(MAX).filter((k) => typeof d[k] === "string");
    // Tags to add (never removes any).
    if (Array.isArray(d.add_tags)) await query("update companies set tags = array(select distinct unnest(tags || $2::text[])) where id = $1", [id, list(d.add_tags)]);
    if (!keys.length) return { id };
    await query(`update companies set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() where id = $1 and deleted_at is null`, [id, ...keys.map((k) => str(d[k], MAX[k]))]);
    return { id };
  },
  /** Research may fill verified blank public fields, never replace existing company details. */
  "company.enrich": async (d, s) => {
    owner(s);
    const id = need(int(d.id), "Pick a company."), expectedName = str(d.expected_name, 160);
    if (!expectedName) throw new Problem("Include the company name being verified.");
    const input = d.fields && typeof d.fields === "object" && !Array.isArray(d.fields) ? d.fields as Data : {};
    const fields = ["website", "email", "phone"] as const;
    const candidates: Partial<Record<typeof fields[number], { value: string; sourceUrl: string }>> = {};
    const publicUrl = (value: string) => {
      let url: URL;
      try { url = new URL(value); } catch { throw new Problem("Use a complete public source URL."); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")
        || /(^|\.)(localhost|example|invalid|test)$/.test(url.hostname) || /(^|\.)example\.(com|org|net)$/.test(url.hostname) || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname))
        throw new Problem("Use a public business website or source URL.");
      return url.href;
    };
    for (const field of fields) {
      const item = input[field];
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const supplied = item as Data, value = str(supplied.value, field === "website" ? 300 : field === "email" ? 200 : 40);
      if (!value) continue;
      const sourceUrl = publicUrl(str(supplied.sourceUrl, 1500));
      if (field === "website") publicUrl(value);
      if (field === "email" && (!looksLikeEmail(value) || /@(example\.(com|org|net)|[^@]+\.(example|invalid|test))$/i.test(value))) throw new Problem("Use a published business email address.");
      if (field === "phone" && !/^\d{10,15}$/.test(value.replace(/\D/g, ""))) throw new Problem("Use a published phone number including its area code.");
      candidates[field] = { value, sourceUrl };
    }
    if (!Object.keys(candidates).length) throw new Problem("No verified fields were supplied.");
    return transaction(async (tx) => {
      const row = (await tx.query("select id::int, name, website, email, phone, tags from companies where id = $1 and deleted_at is null for update", [id]))[0];
      if (!row || row.name !== expectedName) throw new Problem("The company changed. Check its identity again.");
      if ((Array.isArray(row.tags) && row.tags.some((tag) => String(tag).toLowerCase() === "test data")) || /\bsample\b/i.test(String(row.name))
        || /\.(example|invalid|test)(?:[/:]|$)/i.test(String(row.website))) throw new Problem("Do not enrich fictional test records with real business details.");
      const filled: Record<string, { value: string; sourceUrl: string }> = {}, skipped: string[] = [];
      for (const field of fields) {
        const candidate = candidates[field];
        if (!candidate) continue;
        if (String(row[field] ?? "").trim()) { skipped.push(field); continue; }
        // The locked row and the WHERE condition both protect against overwriting a concurrent edit.
        await tx.query(`update companies set ${field} = $2, updated_at = now() where id = $1 and deleted_at is null and nullif(trim(${field}), '') is null`, [id, candidate.value]);
        await tx.query("insert into company_enrichment_sources (company_id, field, value, source_url, added_by) values ($1, $2, $3, $4, $5) on conflict do nothing",
          [id, field, candidate.value, candidate.sourceUrl, s.user.id]);
        filled[field] = candidate;
      }
      return { id, filled, skipped };
    });
  },
  /** Two records for one business (no duplicates): everything on `from` moves to `into`, then `from` is deleted. */
  "company.merge": async (d) => {
    const from = need(int(d.from), "Pick the company to merge."), into = need(int(d.into), "Pick the company to keep.");
    if (from === into) throw new Problem("Pick two different companies.");
    await transaction(async (tx) => {
      if ((await tx.query("select id from companies where id = any($1::bigint[]) and deleted_at is null", [[from, into]])).length < 2) throw new Problem("One of them was just deleted. Refresh and try again.");
      await tx.query("insert into contact_companies (contact_id, company_id, title) select contact_id, $2, title from contact_companies where company_id = $1 on conflict do nothing", [from, into]);
      await tx.query("delete from contact_companies where company_id = $1", [from]);
      for (const t of ["notes", "todos", "opportunities", "emails"]) await tx.query(`update ${t} set company_id = $2 where company_id = $1`, [from, into]);
      // One lead per company: the kept one's stays; otherwise the merged one's moves over.
      await tx.query("update leads set company_id = $2 where company_id = $1 and deleted_at is null and not exists (select 1 from leads where company_id = $2 and deleted_at is null)", [from, into]);
      await tx.query("update leads set deleted_at = now() where company_id = $1 and deleted_at is null", [from]);
      // On each campaign list once.
      await tx.query("update campaign_people p set company_id = $2 where p.company_id = $1 and not exists (select 1 from campaign_people x where x.campaign_id = p.campaign_id and x.company_id = $2)", [from, into]);
      await tx.query("delete from campaign_people where company_id = $1", [from]);
      // Facts the kept one is missing come from the merged one; tags and needs join.
      await tx.query(`update companies k set website = coalesce(nullif(k.website, ''), f.website), phone = coalesce(nullif(k.phone, ''), f.phone), email = coalesce(nullif(k.email, ''), f.email),
          industry = coalesce(nullif(k.industry, ''), f.industry), city = coalesce(nullif(k.city, ''), f.city), state = coalesce(nullif(k.state, ''), f.state),
          street = coalesce(nullif(k.street, ''), f.street), zip = coalesce(nullif(k.zip, ''), f.zip), linkedin = coalesce(nullif(k.linkedin, ''), f.linkedin),
          socials = coalesce(nullif(k.socials, ''), f.socials), description = coalesce(nullif(k.description, ''), f.description), size = coalesce(nullif(k.size, ''), f.size),
          revenue = coalesce(nullif(k.revenue, ''), f.revenue), tech = coalesce(nullif(k.tech, ''), f.tech), owner_id = coalesce(k.owner_id, f.owner_id),
          next_follow_up = least(k.next_follow_up, f.next_follow_up),
          tags = array(select distinct unnest(k.tags || f.tags)), needs = array(select distinct unnest(k.needs || f.needs)), updated_at = now()
        from companies f where k.id = $2 and f.id = $1`, [from, into]);
      await tx.query("update companies set deleted_at = now() where id = $1", [from]);
    });
    return { id: into };
  },
  "company.delete": async (d) => {
    const ids = Array.isArray(d.ids) ? d.ids.map(int).filter((x): x is number => !!x).slice(0, 5000) : [need(int(d.id), "Pick a company.")];
    await query("update companies set deleted_at = now() where id = any($1::bigint[]) and deleted_at is null", [ids]);
  },
  /** Add someone to a company (an existing contact, or a new one by name), or take them off it. */
  "company.add_person": async (d, s) => {
    const company = need(int(d.company_id), "Pick a company.");
    let contact = int(d.contact_id);
    if (!contact) {
      const [first, ...rest] = str(d.name, 160).split(/\s+/);
      if (!first) throw new Problem("Pick someone or type a name.");
      contact = (await one<{ id: number }>("insert into contacts (first_name, last_name, job_title, created_by) values ($1, $2, $3, $4) returning id::int", [first, rest.join(" "), str(d.title, 120), s.user.id]))!.id;
    }
    await query("insert into contact_companies (contact_id, company_id, title) values ($1, $2, $3) on conflict (contact_id, company_id) do update set title = excluded.title", [contact, company, str(d.title, 120)]);
    return { id: contact };
  },
  "company.remove_person": async (d) => { await query("delete from contact_companies where contact_id = $1 and company_id = $2", [int(d.contact_id), int(d.company_id)]); },

  // ---------------------------------------------------------------- the timeline
  "note.add": async (d, s) => {
    const body = text(d.body);
    if (!body) throw new Problem("Write the note first.");
    const contact = int(d.contact_id), company = int(d.company_id), opportunity = int(d.opportunity_id);
    if (!contact && !company && !opportunity) throw new Problem("Pick who it’s about.");
    const kind = ACTIVITY_KINDS.some(([k]) => k === d.kind) ? String(d.kind) : "note";
    const on = date(d.happened_on);
    const attachments = Array.isArray(d.attachments) ? d.attachments.slice(0, 20) : [];
    const r = await one<{ id: number }>("insert into notes (contact_id, company_id, opportunity_id, kind, body, author_id, happened_at, attachments) values ($1, $2, $3, $4, $5, $6, ($7::date + time '12:00') at time zone 'America/Los_Angeles', $8::text::jsonb) returning id::int",
      [contact, company, opportunity, kind, body, s.user.id, on, JSON.stringify(attachments)]);
    // A call, email, meeting… (or "We talked") counts as a touch, on the day it happened; never moves the last touch back.
    if (contact && (d.touch || INTERACTIONS.includes(kind)))
      await query("update contacts set last_contacted = greatest(coalesce(last_contacted, $2::date), $2::date) where id = $1", [contact, on ?? today()]);
    // Brendan 10-15: logging a call, email, meeting… finishes a follow-up that's due on that record (a later one stays).
    if (INTERACTIONS.includes(kind))
      for (const [table, id] of [["contacts", contact], ["companies", company], ["opportunities", opportunity]] as const)
        if (id) await query(`update ${table} set next_follow_up = null, updated_at = now() where id = $1 and next_follow_up <= $2::date`, [id, today()]);
    return { id: r!.id };
  },
  "note.save": async (d) => {
    const body = text(d.body);
    if (!body) throw new Problem("A note can’t be empty. Delete it instead.");
    const attachments = Array.isArray(d.attachments) ? JSON.stringify(d.attachments.slice(0, 20)) : null;
    await query("update notes set body = $2, attachments = coalesce($3::text::jsonb, attachments), updated_at = now() where id = $1 and deleted_at is null", [need(int(d.id), "Pick a note."), body, attachments]);
  },
  "note.delete": async (d) => { await query("update notes set deleted_at = now() where id = $1", [need(int(d.id), "Pick a note.")]); },

  // ---------------------------------------------------------------- to-dos
  "todo.save": async (d, s) => {
    const title = str(d.title, 300);
    if (!title) throw new Problem("Add what needs doing.");
    const subtasks = Array.isArray(d.subtasks) ? d.subtasks.slice(0, 100) : [], comments = Array.isArray(d.comments) ? d.comments.slice(0, 100) : [];
    const position = d.position !== undefined && Number.isFinite(Number(d.position)) ? Number(d.position) : null;
    const f = [title, text(d.notes).slice(0, 4000), date(d.due), d.high === true, int(d.assigned_to), int(d.contact_id), int(d.company_id), int(d.opportunity_id), JSON.stringify(subtasks), JSON.stringify(comments), position];
    const id = int(d.id);
    // Editing leaves the project link as it was (the form doesn't show it).
    // Who gave it to its person, and when (the bell: "Nathan gave you a to-do").
    if (id) { await query(`update todos set title=$2, notes=$3, due=$4, high=$5, contact_id=$7, company_id=$8, opportunity_id=coalesce($9, opportunity_id), subtasks=$10::text::jsonb, comments=$11::text::jsonb, position=coalesce($12, position),
      assigned_by = case when assigned_to is distinct from $6 then (case when $6::bigint is not null then $10::bigint end) else assigned_by end,
      assigned_at = case when assigned_to is distinct from $6 then (case when $6::bigint is not null then now() end) else assigned_at end, assigned_to=$6 where id=$1`, [id, ...f, s.user.id]); return { id }; }
    return one<{ id: number }>("insert into todos (title, notes, due, high, assigned_to, contact_id, company_id, opportunity_id, subtasks, comments, position, created_by, assigned_by, assigned_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb,coalesce($11, (select coalesce(max(position), 0) + 1 from todos)),$12, case when $5::bigint is not null then $12::bigint end, case when $5::bigint is not null then now() end) returning id::int", [...f, s.user.id]) as never;
  },
  "todo.done": async (d) => { await query("update todos set done_at = case when $2 then now() end where id = $1", [need(int(d.id), "Pick a to-do."), d.done !== false]); },
  "todo.delete": async (d) => { await query("update todos set deleted_at = now() where id = $1", [need(int(d.id), "Pick a to-do.")]); },

  // ---------------------------------------------------------------- leads (a company or a person being pursued)
  /** Mark as a lead, or change one. A company or person has at most one lead; marking again updates it. */
  "lead.save": async (d, s) => {
    const company = int(d.company_id), contact = int(d.contact_id), id = int(d.id);
    const stage = LEAD_STAGES.some(([v]) => v === d.stage) ? String(d.stage) : "new";
    const priority = ["high", "medium", "low"].includes(String(d.priority)) ? String(d.priority) : "medium";
    const f = [stage, priority, str(d.source, 80), list(d.interested), int(d.owner_id)];
    if (id) {
      await query("update leads set stage_at = case when stage <> $2 then now() else stage_at end, stage = $2, priority = $3, source = $4, interested = $5, owner_id = $6 where id = $1", [id, ...f]);
      return { id };
    }
    if (!company === !contact) throw new Problem("Pick a company or a person.");
    const had = await one<{ id: number }>(`select id::int from leads where deleted_at is null and ${company ? "company_id" : "contact_id"} = $1`, [company ?? contact]);
    if (had) return actions["lead.save"]({ ...d, id: had.id }, s) as never;
    return one<{ id: number }>("insert into leads (company_id, contact_id, stage, priority, source, interested, owner_id, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id::int", [company, contact, ...f, s.user.id]) as never;
  },
  "lead.stage": async (d) => {
    const stage = String(d.stage);
    if (!LEAD_STAGES.some(([v]) => v === stage)) throw new Problem("Pick a stage.");
    const ids = (Array.isArray(d.ids) ? d.ids : [d.id]).map(int).filter((x): x is number => !!x).slice(0, 3000);
    if (!ids.length) throw new Problem("Pick a lead.");
    await query("update leads set stage = $2, stage_at = now() where id = any($1::bigint[]) and stage <> $2 and deleted_at is null", [ids, stage]);
  },
  /** Many companies at once (a prospect list, e.g. the Kern 1000): the ones already leads are left as they are. */
  "lead.add_companies": async (d, s) => {
    const ids = (Array.isArray(d.company_ids) ? d.company_ids : []).map(int).filter((x): x is number => !!x).slice(0, 3000);
    const r = await query<{ id: number }>(`insert into leads (company_id, source, created_by) select co.id, $2, $3 from companies co
      where co.id = any($1::bigint[]) and co.deleted_at is null and not exists (select 1 from leads l where l.company_id = co.id and l.deleted_at is null) returning id::int`, [ids, str(d.source, 80), s.user.id]);
    return { ids: r.map((x) => x.id) };
  },
  /** No longer a lead (the company or person stays in the Rolodex). */
  "lead.delete": async (d) => { await query("update leads set deleted_at = now() where id = $1", [need(int(d.id), "Pick a lead.")]); },

  // ---------------------------------------------------------------- opportunities (a specific potential project)
  "opportunity.save": async (d, s) => {
    const name = str(d.name, 200);
    if (!name) throw new Problem("Name the project.");
    const stage = OPP_STAGES.some(([v]) => v === d.stage) ? String(d.stage) : "lead";
    const value = dollars(d.value);
    const id = int(d.id);
    return transaction(async (tx) => {
      // A company typed by name that isn't in the Rolodex yet is added.
      const company = int(d.company_id) ?? (str(d.company, 160) ? await companyFor(tx as never, { name: d.company }, s) : null);
      const f = [name, company, int(d.contact_id), stage, value, date(d.close_date), date(d.next_follow_up), int(d.owner_id)];
      if (id) {
        // A new stage puts it at the top of that column on the board.
        await tx.query(`update opportunities set name=$2, company_id=$3, contact_id=$4, ${STAGE_CHANGE("$5", "$10")},
          position = case when stage <> $5 then ${TOP_OF("$5")} else position end, stage=$5, value_cents=$6, close_date=$7, next_follow_up=$8, owner_id=$9, updated_at=now()
          where id=$1 and deleted_at is null`, [id, ...f, s.user.id]);
        return { id, companyId: company };
      }
      const created = (await tx.query(`insert into opportunities (name, company_id, contact_id, stage, value_cents, close_date, next_follow_up, owner_id, closed_at, closed_by, position, created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8, case when $4 in ('won','lost') then now() end, case when $4 in ('won','lost') then $9::bigint end, ${TOP_OF("$4")}, $9) returning id::int`, [...f, s.user.id]))[0] as { id: number };
      return { ...created, companyId: company };
    });
  },
  /**
   * The board, a card's stage menu, and Won / Lost on a project's page: a stage, and a place in it between its
   * neighbours (no place: the top of that stage). The stage is renumbered 1, 2, 3… after, so places never run out.
   */
  "opportunity.move": async (d, s) => {
    const id = need(int(d.id), "Pick a project."), stage = String(d.stage);
    if (!OPP_STAGES.some(([v]) => v === stage)) throw new Problem("Pick a stage.");
    const position = d.position !== undefined && d.position !== null && d.position !== "" && Number.isFinite(Number(d.position)) ? Number(d.position) : null;
    await transaction(async (tx) => {
      await tx.query(`update opportunities set ${STAGE_CHANGE("$2", "$4")}, stage = $2, position = coalesce($3::float8, ${TOP_OF("$2")}), updated_at = now()
        where id = $1 and deleted_at is null`, [id, stage, position, s.user.id]);
      await tx.query(`update opportunities o set position = r.n from (select id, row_number() over (order by position, created_at desc)::float8 as n
        from opportunities where stage = $1 and deleted_at is null) r where o.id = r.id and o.position <> r.n`, [stage]);
    });
  },
  "opportunity.follow_up": async (d) => { await query("update opportunities set next_follow_up = $2, updated_at = now() where id = $1", [need(int(d.id), "Pick a project."), date(d.date)]); },
  "opportunity.delete": async (d) => { await query("update opportunities set deleted_at = now() where id = $1", [need(int(d.id), "Pick a project.")]); },

  // ---------------------------------------------------------------- the network: how two people know each other
  "relationship.save": async (d, s) => {
    const a = need(int(d.contact_id), "Pick the first person."), b = need(int(d.other_id), "Pick who they know.");
    if (a === b) throw new Problem("Pick two different people.");
    const kind = RELATION_KINDS.some(([k]) => k === d.kind) ? String(d.kind) : "knows", id = int(d.id);
    if (id) { await query("update relationships set contact_id = $2, other_id = $3, kind = $4, note = $5 where id = $1", [id, a, b, kind, text(d.note).slice(0, 2000)]); return { id }; }
    const had = await one<{ id: number }>("select id::int from relationships where deleted_at is null and least(contact_id, other_id) = least($1::bigint, $2::bigint) and greatest(contact_id, other_id) = greatest($1::bigint, $2::bigint) and kind = $3", [a, b, kind]);
    if (had) return { id: had.id };
    return one<{ id: number }>("insert into relationships (contact_id, other_id, kind, note, created_by) values ($1, $2, $3, $4, $5) returning id::int", [a, b, kind, text(d.note).slice(0, 2000), s.user.id]) as never;
  },
  "relationship.delete": async (d) => { await query("update relationships set deleted_at = now() where id = $1", [need(int(d.id), "Pick a connection.")]); },

  // ---------------------------------------------------------------- outreach (send-only email)
  "template.save": async (d, s) => {
    const name = str(d.name, 120);
    if (!name) throw new Problem("Name the template.");
    const f = [name, str(d.subject, 300), text(d.body).slice(0, 20000)], id = int(d.id);
    if (id) { await query("update email_templates set name=$2, subject=$3, body=$4, updated_at=now() where id=$1", [id, ...f]); return { id }; }
    return one<{ id: number }>("insert into email_templates (name, subject, body, created_by) values ($1,$2,$3,$4) returning id::int", [...f, s.user.id]) as never;
  },
  "template.delete": async (d) => { await query("update email_templates set deleted_at = now() where id = $1", [need(int(d.id), "Pick a template.")]); },
  /** One email to a person or a company, written in the popup (already filled in). */
  "email.send": async (d, s) => {
    const r = await sendOne(s, { contact: int(d.contact_id), company: int(d.company_id), to: str(d.to, 254), subject: str(d.subject, 300), body: text(d.body) });
    if (r.status === "failed") throw new Problem("It didn’t send: " + r.error);
    return { id: r.id };
  },
  "campaign.save": async (d, s) => {
    const name = str(d.name, 160);
    if (!name) throw new Problem("Name the campaign.");
    const f = [name, str(d.subject, 300), text(d.body).slice(0, 20000)], id = int(d.id);
    if (id) { await query("update campaigns set name=$2, subject=$3, body=$4 where id=$1", [id, ...f]); return { id }; }
    return one<{ id: number }>("insert into campaigns (name, subject, body, created_by) values ($1,$2,$3,$4) returning id::int", [...f, s.user.id]) as never;
  },
  "campaign.delete": async (d) => { await query("update campaigns set deleted_at = now() where id = $1", [need(int(d.id), "Pick a campaign.")]); },
  /** People and companies onto a campaign's list (ones already on it stay as they are). */
  "campaign.add": async (d) => {
    const id = need(int(d.campaign_id), "Pick a campaign.");
    const ids = (v: unknown) => (Array.isArray(v) ? v : []).map(int).filter((x): x is number => !!x).slice(0, 3000);
    await query("insert into campaign_people (campaign_id, contact_id) select $1, unnest($2::bigint[]) on conflict do nothing", [id, ids(d.contact_ids)]);
    await query("insert into campaign_people (campaign_id, company_id) select $1, unnest($2::bigint[]) on conflict do nothing", [id, ids(d.company_ids)]);
  },
  "campaign.remove": async (d) => {
    await query("delete from campaign_people where campaign_id = $1 and (contact_id = $2 or company_id = $3)", [int(d.campaign_id), int(d.contact_id), int(d.company_id)]);
  },
  /** Replied, needs a follow-up, not interested… marked by hand (replies arrive in the normal inbox). */
  "campaign.status": async (d) => {
    const status = String(d.status);
    if (!["to_send", "sent", "replied", "follow_up", "not_interested", "skipped"].includes(status)) throw new Problem("Pick a status.");
    await query("update campaign_people set status = $4, status_at = now() where campaign_id = $1 and (contact_id = $2 or company_id = $3)", [int(d.campaign_id), int(d.contact_id), int(d.company_id), status]);
  },
  /** Sends the campaign's email, filled in for each person, to everyone still "to send" who has an email address. */
  "campaign.send": async (d, s) => {
    const id = need(int(d.campaign_id), "Pick a campaign.");
    const c = await one<{ subject: string; body: string }>("select subject, body from campaigns where id = $1 and deleted_at is null", [id]);
    if (!c) throw new Problem("That campaign is gone.");
    if (!c.subject.trim() || !c.body.trim()) throw new Problem("Write the subject and the email first.");
    const people = await query<{ contact_id: number | null; company_id: number | null }>("select contact_id::int, company_id::int from campaign_people where campaign_id = $1 and status = 'to_send'", [id]);
    let sent = 0, skipped = 0, failed = 0;
    for (const p of people.slice(0, 500)) {
      const r = await sendOne(s, { contact: p.contact_id, company: p.company_id, subject: c.subject, body: c.body, campaign: id, fill: true });
      if (r.status === "failed") failed++; else if (r.status === "skipped") skipped++; else sent++;
    }
    return { ids: [sent, skipped, failed] };
  },

  // ---------------------------------------------------------------- Recently Deleted
  restore: async (d) => {
    const table = TABLES[String(d.kind)];
    if (!table) throw new Problem("That can’t be brought back.");
    await query(`update ${table} set deleted_at = null where id = any($1::bigint[])`, [ids(d, "Pick what to bring back.")]);
  },
  "deleted.purge": async (d) => {
    if (d.confirm !== "permanently-delete") throw new Problem("Confirm permanent deletion first.");
    const cutoff = str(d.cutoff, 40);
    if (!Number.isFinite(Date.parse(cutoff)) || Date.parse(cutoff) > Date.now() + 1000) throw new Problem("Refresh Recently Deleted and try again.");
    if (!Array.isArray(d.items) || !d.items.length || d.items.length > 10000) throw new Problem("Refresh Recently Deleted and try again.");
    const seen = new Set<string>();
    const items: DeletedSnapshotItem[] = [];
    for (const value of d.items) {
      const item = value as Data, kind = str(item?.kind, 20), id = int(item?.id), deleted_at = str(item?.deleted_at, 40);
      if (!PURGE_KINDS.has(kind) || !id || !Number.isFinite(Date.parse(deleted_at))) throw new Problem("Refresh Recently Deleted and try again.");
      const key = kind + ":" + id;
      if (!seen.has(key)) { seen.add(key); items.push({ kind, id, deleted_at }); }
    }
    return transaction((tx) => purgeDeletedSnapshot(tx, items, cutoff));
  },
  /** Right-click → Delete, and Select → Delete for many at once (Brendan 10-15: "anything on this software"). All go to Recently Deleted. */
  "delete.many": async (d) => {
    const table = TABLES[String(d.kind)];
    if (!table) throw new Problem("That can’t be deleted.");
    await query(`update ${table} set deleted_at = now() where id = any($1::bigint[]) and deleted_at is null`, [ids(d, "Pick what to delete.")]);
  },

  // ---------------------------------------------------------------- follow-ups on a person, a company or a project
  /**
   * Done, in one click: a person counts as in touch today (a project's person too) and the follow-up is cleared, or
   * moved to `next`. Someone with a keep-in-touch rhythm comes back on their own when it's due again. Answers what it
   * replaced, so Undo can put it back.
   */
  "followup.done": async (d) => {
    const { table, id } = followTarget(d), next = date(d.next);
    return transaction(async (tx) => {
      const was = ((await tx.query(`select next_follow_up::text${table === "opportunities" ? ", contact_id::int" : ""}${table === "contacts" ? ", last_contacted::text" : ""} from ${table} where id = $1 and deleted_at is null`, [id]))[0] ?? null) as { next_follow_up: string | null; contact_id?: number | null; last_contacted?: string | null } | null;
      if (!was) throw new Problem("That was deleted.");
      await tx.query(`update ${table} set next_follow_up = $2, updated_at = now() where id = $1`, [id, next]);
      const person = table === "contacts" ? id : was.contact_id ?? null;
      let touched: string | null = null;
      if (person) {
        touched = (((await tx.query("select last_contacted::text from contacts where id = $1", [person]))[0] ?? {}) as { last_contacted?: string | null }).last_contacted ?? null;
        await tx.query("update contacts set last_contacted = greatest(last_contacted, $2::date), updated_at = now() where id = $1", [person, today()]);
      }
      return { id, was: { next_follow_up: was.next_follow_up, person, last_contacted: touched } };
    });
  },
  /** Set (or clear) the next follow-up on a person, company or project. */
  "followup.set": async (d) => {
    const { table, id } = followTarget(d);
    await query(`update ${table} set next_follow_up = $2, updated_at = now() where id = $1 and deleted_at is null`, [id, date(d.date)]);
    return { id };
  },
  /** Undo a Done: the follow-up date and the person's last-in-touch day go back to what they were. */
  "followup.undo": async (d) => {
    const { table, id } = followTarget(d), was = (d.was ?? {}) as Data;
    await transaction(async (tx) => {
      await tx.query(`update ${table} set next_follow_up = $2, updated_at = now() where id = $1`, [id, date(was.next_follow_up)]);
      const person = int(was.person);
      if (person) await tx.query("update contacts set last_contacted = $2, updated_at = now() where id = $1", [person, date(was.last_contacted)]);
    });
  },

  // ---------------------------------------------------------------- CSV import (components/import-csv.tsx reads the file in the browser)
  /**
   * An updated spreadsheet of people already in Rolodex: adds the phones and emails each one is missing (never removes
   * or overwrites any). Matched by full name (any of the names given), narrowed by company when two share a name.
   * `dry` answers what it would do without saving.
   */
  "import.details": async (d) => {
    const rows = (Array.isArray(d.rows) ? d.rows : []).slice(0, 5000) as Data[];
    const report: { name: string; status: string; id?: number; phones?: string[]; emails?: string[] }[] = [];
    const digits = (x: string) => x.replace(/\D/g, "").slice(-10);
    await transaction(async (tx) => {
      for (const r of rows) {
        const names = (Array.isArray(r.names) ? r.names : []).map((x) => str(x, 160).toLowerCase()).filter(Boolean);
        const label = str(r.name, 160) || names[0] || "";
        let found = (await tx.query(`select c.id::int, c.phones, c.emails from contacts c where c.deleted_at is null and lower(trim(c.first_name || ' ' || c.last_name)) = any($1::text[])`, [names])) as { id: number; phones: { label: string; value: string }[]; emails: { label: string; value: string }[] }[];
        if (found.length > 1 && str(r.company, 160)) {
          const ids = (await tx.query(`select cc.contact_id::int as id from contact_companies cc join companies co on co.id = cc.company_id
            where cc.contact_id = any($1::bigint[]) and ${SAME_NAME("co.name")} = ${SAME_NAME("$2")}`, [found.map((f) => f.id), str(r.company, 160)])) as { id: number }[];
          found = found.filter((f) => ids.some((x) => x.id === f.id));
        }
        if (found.length !== 1) { report.push({ name: label, status: found.length ? "two or more match" : "not in Rolodex" }); continue; }
        const c = found[0];
        const phones = labeled(r.phones).filter((p) => digits(p.value).length >= 7 && !c.phones.some((x) => digits(x.value) === digits(p.value)));
        const emails = labeled(r.emails).filter((e) => looksLikeEmail(e.value) && !c.emails.some((x) => x.value.trim().toLowerCase() === e.value.trim().toLowerCase()));
        if (!phones.length && !emails.length) { report.push({ name: label, id: c.id, status: "already has these" }); continue; }
        if (d.dry !== true) await tx.query("update contacts set phones = $2::text::jsonb, emails = $3::text::jsonb, updated_at = now() where id = $1",
          [c.id, JSON.stringify([...c.phones, ...phones].slice(0, 8)), JSON.stringify([...c.emails, ...emails].slice(0, 8))]);
        report.push({ name: label, id: c.id, status: "added", phones: phones.map((p) => p.value), emails: emails.map((e) => e.value) });
      }
    });
    return { report };
  },
  "import.contacts": async (d, s) => {
    const rows = (Array.isArray(d.rows) ? d.rows : []).slice(0, 5000) as Data[];
    if (!rows.length) throw new Problem("There’s nothing to import.");
    const tags = list(d.tags);
    const ids: number[] = [];
    await transaction(async (tx) => {
      for (const r of rows) {
        const first = str(r.first_name, 80), last = str(r.last_name, 80);
        if (!first && !last) continue;
        const email = str(r.email, 200);
        // Someone already in the Rolodex with the same email isn't added twice.
        if (email && (await tx.query("select 1 from contacts where deleted_at is null and lower(emails::text) like $1 limit 1", ["%\"" + email.toLowerCase().replace(/[%_"]/g, "") + "\"%"])).length) continue;
        const id = ((await tx.query(`insert into contacts (first_name, last_name, job_title, phones, emails, website, linkedin, city, state, how_met, tags, created_by)
          values ($1,$2,$3,$4::text::jsonb,$5::text::jsonb,$6,$7,$8,$9,$10,$11,$12) returning id::int`,
          [first, last, str(r.job_title, 120), JSON.stringify(str(r.phone, 40) ? [{ label: "", value: str(r.phone, 40) }] : []),
            JSON.stringify(email ? [{ label: "", value: email }] : []), str(r.website, 300), str(r.linkedin, 300), str(r.city, 80), str(r.state, 40),
            text(r.how_met).slice(0, 2000), tags, s.user.id]))[0] as { id: number }).id;
        ids.push(id);
        if (str(r.company, 160)) {
          const co = await companyFor(tx as never, { name: r.company }, s);
          if (co) await tx.query("insert into contact_companies (contact_id, company_id) values ($1, $2) on conflict do nothing", [id, co]);
        }
        if (text(r.note)) await tx.query("insert into notes (contact_id, body, author_id) values ($1, $2, $3)", [id, text(r.note), s.user.id]);
      }
    });
    return { ids };
  },

  // ---------------------------------------------------------------- team and settings (owners)
  "user.save": async (d, s) => {
    owner(s);
    const name = str(d.name, 80), email = str(d.email, 254).toLowerCase(), password = String(d.password ?? ""), id = int(d.id);
    const why = accountProblem({ name, email, password });
    if (why) throw new Problem(why);
    const other = await userByEmail(email);
    if (other && other.id !== id) throw new Problem("Someone already signs in with that email.");
    const role = d.role === "owner" ? "owner" : "sales";
    if (id) {
      if (id === s.user.id && role !== "owner") throw new Problem("You can’t take away your own owner access.");
      await query(`update users set name=$2, email=$3, role=$4, password_hash=coalesce($5, password_hash), session_version=session_version+$6, updated_at=now() where id=$1`,
        [id, name, email, role, password ? await hashPassword(password) : null, password ? 1 : 0]);
      return { id };
    }
    if (password.length < MIN_PASSWORD) throw new Problem("Give them a password of at least " + MIN_PASSWORD + " characters.");
    return one<{ id: number }>("insert into users (name, email, role, password_hash) values ($1, $2, $3, $4) returning id::int", [name, email, role, await hashPassword(password)]) as never;
  },
  "user.active": async (d, s) => {
    owner(s);
    const id = need(int(d.id), "Pick an account.");
    if (id === s.user.id) throw new Problem("You can’t turn off your own account.");
    await query("update users set active = $2, session_version = session_version + case when $2 then 0 else 1 end where id = $1", [id, d.active === true]);
  },
  "me.save": async (d, s) => {
    const name = str(d.name, 80), password = String(d.password ?? "");
    const why = accountProblem({ name, email: s.user.email, password });
    if (why) throw new Problem(why);
    await query("update users set name = $2, phone = $3, password_hash = coalesce($4, password_hash), signature = coalesce($5, signature), updated_at = now() where id = $1",
      [s.user.id, name, str(d.phone, 40), password ? await hashPassword(password) : null, typeof d.signature === "string" ? text(d.signature).slice(0, 2000) : null]);
  },
  "settings.services": async (d, s) => {
    owner(s);
    await query("insert into settings (key, value) values ('services', $1) on conflict (key) do update set value = excluded.value", [list(d.services, 60).join("\n")]);
  },
};

/**
 * Sends one email and records it: the emails table, an Email entry on their timeline (a touch for a person), and the
 * campaign list's status. `fill`: the text still has {{first_name}}… to fill for this person. No address: skipped.
 */
async function sendOne(s: Session, o: { contact?: number | null; company?: number | null; to?: string; subject: string; body: string; campaign?: number; fill?: boolean }) {
  const who = o.contact
    ? await one<{ first_name: string; last_name: string; emails: unknown; company: string | null }>(`select first_name, last_name, emails,
        (select co.name from contact_companies cc join companies co on co.id = cc.company_id where cc.contact_id = c.id limit 1) as company from contacts c where id = $1 and deleted_at is null`, [o.contact])
    : null;
  const co = !o.contact && o.company ? await one<{ name: string; email: string }>("select name, email from companies where id = $1 and deleted_at is null", [o.company]) : null;
  if (!who && !co) throw new Problem("Pick who it goes to.");
  const emails = who ? (typeof who.emails === "string" ? JSON.parse(who.emails) : who.emails) as { value: string }[] : [];
  const to = (o.to || (who ? emails[0]?.value ?? "" : co!.email)).trim();
  if (!looksLikeEmail(to)) {
    if (o.campaign) return { status: "skipped" as const, id: 0 };
    throw new Problem("Add an email address first.");
  }
  const me = await one<{ name: string; email: string; signature: string }>("select name, email, signature from users where id = $1", [s.user.id]);
  const vars = { first_name: who?.first_name || "there", name: who ? fullName(who) : co!.name, company: who?.company ?? co?.name ?? "", my_name: me!.name };
  const subject = o.fill ? fill(o.subject, vars) : o.subject, body = (o.fill ? fill(o.body, vars) : o.body) + (me!.signature.trim() ? "\n\n" + me!.signature.trim() : "");
  if (!subject.trim() || !o.body.trim()) throw new Problem("Write a subject and a message.");
  const r = await sendEmail({ to, fromName: me!.name, fromEmail: me!.email, subject, text: body });
  const row = await one<{ id: number }>(`insert into emails (contact_id, company_id, campaign_id, to_email, from_email, subject, body, status, provider_id, error, sent_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id::int`, [o.contact ?? null, o.company ?? null, o.campaign ?? null, to, me!.email, subject, body, r.status,
    r.status === "failed" ? "" : r.id, r.status === "failed" ? r.error : "", s.user.id]);
  if (r.status === "failed") return { status: "failed" as const, error: r.error, id: row!.id };
  await query("insert into notes (contact_id, company_id, kind, body, author_id) values ($1, $2, 'email', $3, $4)", [o.contact ?? null, o.contact ? null : o.company, "Emailed: " + subject + "\n\n" + body, s.user.id]);
  if (o.contact) await query("update contacts set last_contacted = $2 where id = $1", [o.contact, today()]);
  if (o.campaign) await query("update campaign_people set status = 'sent', status_at = now() where campaign_id = $1 and (contact_id = $2 or company_id = $3)", [o.campaign, o.contact ?? null, o.company ?? null]);
  return { status: r.status, id: row!.id };
}

export async function runAction(name: string, data: Data, s: Session) {
  const fn = actions[name];
  if (!fn) throw new Problem("Unknown action.");
  return (await fn(data, s)) ?? {};
}
