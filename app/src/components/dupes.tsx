"use client";
import { useEffect, useState } from "react";

// No duplicates (Brendan, 2026-10-15: "we do not want any duplicate stuff in this software"). While a contact or a
// company is typed into its form, Rolodex asks /api/dupes whether it's already there and says so, calmly, with Open.
// On save it asks once more; if it is there, the button becomes "Add anyway" (the server refuses without that).

export type Dupe = { id: number; name: string; sub: string; href: string; why: string };

async function ask(q: string): Promise<Dupe[]> {
  if (!q) return [];
  try {
    const r = await fetch("/api/dupes?" + q, { cache: "no-store" });
    const b = await r.json();
    return b.ok && Array.isArray(b.found) ? b.found : [];
  } catch {
    return [];
  }
}

/**
 * `query` is the /api/dupes question for what's typed so far ("" when there's too little to ask about). Answers
 * come ~350ms after typing stops; `now()` asks at once (on save).
 */
export function useDupes(query: string) {
  const [found, setFound] = useState<Dupe[]>([]);
  useEffect(() => {
    if (!query) return;
    let live = true;
    const t = setTimeout(() => { void ask(query).then((f) => { if (live) setFound(f); }); }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [query]);
  const now = async () => { const f = await ask(query); setFound(f); return f; };
  return { found: query ? found : [], now };
}

/** The question for a person: their name (once there's enough of it), emails and phones. */
export function contactQuery(o: { first: string; last: string; emails: string[]; phones: string[]; not?: number }) {
  const p = new URLSearchParams({ type: "contact" });
  let asks = 0;
  if ((o.first.trim() + " " + o.last.trim()).trim().length >= 3) { p.set("first", o.first.trim()); p.set("last", o.last.trim()); asks++; }
  for (const e of o.emails) if (/^\S+@\S+\.\S+$/.test(e.trim())) { p.append("email", e.trim()); asks++; }
  for (const x of o.phones) if (x.replace(/\D/g, "").length >= 7) { p.append("phone", x.trim()); asks++; }
  if (o.not) p.set("not", String(o.not));
  return asks ? p.toString() : "";
}

/** The question for a company: its name and website. */
export function companyQuery(o: { name: string; website: string; not?: number }) {
  const name = o.name.trim(), website = o.website.trim();
  if (name.length < 2 && website.length < 4) return "";
  const p = new URLSearchParams({ type: "company", name: name.length >= 2 ? name : "", website: website.length >= 4 ? website : "" });
  if (o.not) p.set("not", String(o.not));
  return p.toString();
}

/**
 * A company name boiled down the way the server matches it (lib/data.ts SAME_NAME): "ABC Construction, Inc." and
 * "abc construction" are the same company.
 */
export const sameName = (s: string) =>
  s.toLowerCase().replace(/\b(incorporated|inc|llc|l l c|ltd|limited|co|corp|corporation|company|pllc|llp|lp)\b\.?/g, "").replace(/[^a-z0-9]/g, "");

/** The company already in Rolodex that a typed name means, if any. */
export function companyMatch<T extends { id: number; name: string }>(list: T[], typed: string): T | undefined {
  const t = typed.trim();
  if (!t) return undefined;
  const key = sameName(t);
  return list.find((p) => p.name === t) ?? list.find((p) => p.name.toLowerCase() === t.toLowerCase()) ?? (key ? list.find((p) => sameName(p.name) === key) : undefined);
}

/**
 * "Already in Rolodex: Derek Sample · Same email", with Open. `asking`: they tried to save it anyway, so say what
 * the choice is.
 */
export function DupeNotice({ found, onOpen, asking, what }: { found: Dupe[]; onOpen: (href: string) => void; asking?: boolean; what: string }) {
  if (!found.length) return null;
  return (
    <div className={"dupe" + (asking ? " is-asking" : "")} role="status">
      {found.map((d) => (
        <div key={d.id} className="dupe-row">
          <span className="grow"><strong>Already in Rolodex: {d.name} · {d.why}</strong>{d.sub && <small>{d.sub}</small>}</span>
          <button type="button" className="btn btn-sm" onClick={() => onOpen(d.href)}>Open</button>
        </div>
      ))}
      {asking && <p>Open {found.length === 1 ? "it" : "one"} to add what’s new there, or add a new {what} anyway.</p>}
    </div>
  );
}
