"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { save, toast } from "./ui";
import { Icon } from "./icons";

// Import contacts from a CSV file. The file is read here in the browser (it never uploads as a file): pick the
// columns, then the people go to "import.contacts" 500 at a time.

// ---------------------------------------------------------------- reading CSV (RFC 4180)
// csv-parser-start
/** Rows of cells. Handles quoted fields, "" inside quotes, commas and line breaks inside quotes, CRLF/LF/CR, a BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  // Blank lines (and Excel's trailing ",,,," rows) aren't people.
  return rows.filter((r) => r.some((c) => c.trim()));
}
// csv-parser-end

// ---------------------------------------------------------------- which column is which
type Field = "" | "first_name" | "last_name" | "full_name" | "job_title" | "company" | "email" | "phone" | "website" | "linkedin" | "city" | "state" | "how_met" | "note";
const FIELDS: [Field, string][] = [
  ["first_name", "First name"], ["last_name", "Last name"], ["full_name", "Full name (first + last)"], ["job_title", "Job title"],
  ["company", "Company"], ["email", "Email"], ["phone", "Phone"], ["website", "Website"], ["linkedin", "LinkedIn"], ["city", "City"],
  ["state", "State"], ["how_met", "How we met"], ["note", "Note"], ["", "Skip"],
];
// Header names from LinkedIn's Connections.csv, Google Contacts (old and new), Outlook and everyday spreadsheets,
// compared lowercase with only letters and digits ("E-mail 1 - Value" → "email1value").
const GUESS: [Field, RegExp][] = [
  ["first_name", /^(firstname|givenname|first|fname|forename)$/],
  ["last_name", /^(lastname|familyname|surname|last|lname)$/],
  ["full_name", /^(name|fullname|contactname|contact|displayname|person)$/],
  ["job_title", /^(jobtitle|title|position|role|organizationtitle|organization1title)$/],
  ["company", /^(company|companyname|organization|organisation|organizationname|organization1name|employer|business|businessname|accountname)$/],
  ["email", /^(email|emailaddress|email1value|email1|primaryemail|workemail|personalemail|emailaddress1)$/],
  ["phone", /^(phone|phonenumber|phone1value|phone1|mobile|mobilephone|mobilenumber|cell|cellphone|businessphone|workphone|homephone|primaryphone|telephone|tel)$/],
  ["linkedin", /^(linkedin|linkedinurl|linkedinprofile|linkedinprofileurl|profileurl)$/],
  ["website", /^(website|web|webpage|website1value|homepage|site|url)$/],
  ["city", /^(city|town|address1city|businesscity|homecity|locality)$/],
  ["state", /^(state|region|province|address1region|businessstate|homestate|stateregion)$/],
  ["how_met", /^(howwemet|howmet|howweknowthem|source|leadsource|met)$/],
  ["note", /^(note|notes|comment|comments|description)$/],
];
const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A field for each column; each field once (the first column that matches wins). */
function guess(header: string[], data: string[][]): Field[] {
  const used = new Set<Field>();
  return header.map((h, i) => {
    let f = GUESS.find(([field, re]) => !used.has(field) && re.test(norm(h)))?.[0] ?? "";
    // LinkedIn calls the profile link "URL": a column of linkedin.com links is LinkedIn, not a website.
    if (f === "website" && !used.has("linkedin") && data.slice(0, 20).some((r) => /linkedin\.com\//i.test(r[i] ?? ""))) f = "linkedin";
    if (f) used.add(f);
    return f;
  });
}
/** The header is the first row that looks like one (LinkedIn's export starts with a few lines of notes). */
function headerRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) if (guess(rows[i], []).filter(Boolean).length >= 2) return i;
  return 0;
}

type Person = Partial<Record<Exclude<Field, "" | "full_name">, string>>;
/** The people in the file, under the chosen columns. Two columns on one field join (names, notes) or the first wins. */
function people(data: string[][], map: Field[]): Person[] {
  return data.map((cells) => {
    const r: Partial<Record<Field, string>> = {};
    map.forEach((f, i) => {
      const v = (cells[i] ?? "").trim();
      if (!f || !v) return;
      if (!r[f]) r[f] = v;
      else if (f === "note") r[f] += "\n" + v;
      else if (["first_name", "last_name", "full_name", "job_title", "how_met"].includes(f)) r[f] += " " + v;
    });
    const { full_name: full, ...p } = r;
    if (full && !p.first_name && !p.last_name) {
      // "Smith, Jane" is last-name-first; "Jane Q. Smith" is first word, then the rest.
      const comma = full.indexOf(",");
      if (comma > 0) { p.last_name = full.slice(0, comma).trim(); p.first_name = full.slice(comma + 1).trim(); }
      else { const [first, ...rest] = full.split(/\s+/); p.first_name = first; p.last_name = rest.join(" "); }
    }
    return p as Person;
  });
}

const CHUNK = 500;
const n = (x: number) => x.toLocaleString("en-US");
const plural = (x: number, one: string, many: string) => n(x) + " " + (x === 1 ? one : many);

export function ImportCsv() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; header: string[]; data: string[][] } | null>(null);
  const [map, setMap] = useState<Field[]>([]);
  const [tags, setTags] = useState("");
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(null);

  const list = useMemo(() => (file ? people(file.data, map) : []), [file, map]);
  const named = list.filter((p) => p.first_name || p.last_name);
  const hasName = map.some((f) => f === "first_name" || f === "last_name" || f === "full_name");

  const read = async (f: File | undefined) => {
    if (!f) return;
    setError(""); setDone(null);
    if (/\.(xlsx?|numbers|ods)$/i.test(f.name)) { setError("That’s a spreadsheet file. Save it as CSV first (File → Export or Save As → CSV), then choose that."); return; }
    const rows = parseCsv(await f.text());
    const h = headerRow(rows);
    const header = rows[h] ?? [], data = rows.slice(h + 1);
    if (!header.length || !data.length) { setError("That file has no rows to import. Check that it’s a CSV with a header row."); return; }
    setFile({ name: f.name, header, data });
    setMap(guess(header, data));
  };

  const go = async () => {
    const rows = named;
    let added = 0;
    setProgress(0);
    for (let i = 0; i < rows.length; i += CHUNK) {
      const r = await save("import.contacts", { rows: rows.slice(i, i + CHUNK), tags: tags.split(",") });
      if (!r.ok) {
        setProgress(null);
        // Earlier batches are already in; say so, so nobody imports them twice.
        toast((r.error ?? "That didn’t import.") + (added ? " " + plural(added, "contact was", "contacts were") + " imported before it stopped." : ""), true);
        if (added) { setDone({ added, skipped: i - added }); router.refresh(); }
        return;
      }
      added += r.ids?.length ?? 0;
      setProgress(Math.min(i + CHUNK, rows.length));
    }
    setProgress(null);
    setDone({ added, skipped: list.length - added });
    router.refresh();
  };

  const reset = () => { setFile(null); setMap([]); setTags(""); setDone(null); setError(""); if (input.current) input.current.value = ""; };

  if (done) return (
    <div className="card card-pad empty">
      <strong>Imported {plural(done.added, "contact", "contacts")}</strong>
      {done.skipped > 0 && <p style={{ margin: "0 0 4px" }}>{plural(done.skipped, "row was", "rows were")} skipped: no name, or already in your Rolodex (same email).</p>}
      <div className="page-acts" style={{ justifyContent: "center", marginTop: 16 }}>
        <Link className="btn btn-primary" href="/contacts?sort=recent">See contacts</Link>
        <button type="button" className="btn" onClick={reset}>Import another file</button>
      </div>
    </div>
  );

  return (
    <div className="form-grid" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
      <ol className="step-list" aria-label="Import progress"><li aria-current={!file ? "step" : undefined}><b>1</b>Choose file</li><li aria-current={file && progress === null ? "step" : undefined}><b>2</b>Review columns</li><li aria-current={progress !== null ? "step" : undefined}><b>3</b>Import contacts</li></ol>
      <div className={"card card-pad drop" + (over ? " is-over" : "")}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void read(e.dataTransfer.files[0]); }}>
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => void read(e.target.files?.[0])} />
        {file ? <>
          <span className="avatar"><Icon name="import" /></span>
          <div className="drop-copy"><strong>{file.name}</strong><small>{plural(file.data.length, "row", "rows")} · {plural(file.header.length, "column", "columns")}</small></div>
          <button type="button" className="btn" onClick={() => input.current?.click()}>Choose another file</button>
        </> : <>
          <span className="avatar lg"><Icon name="import" /></span>
          <div className="drop-copy"><strong>Choose a CSV file, or drop it here</strong><small>LinkedIn’s Connections.csv, a Google Contacts or Outlook export, or any spreadsheet saved as CSV.</small></div>
          <button type="button" className="btn btn-primary" onClick={() => input.current?.click()}>Choose file</button>
        </>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      {file && <>
        <div className="card card-pad">
          <h3>Match the columns</h3>
          <p className="muted" style={{ margin: "-6px 0 10px", fontSize: 14 }}>We guessed from the column names. Change any that are wrong, or pick Skip.</p>
          <div style={{ overflowX: "auto" }}>
            <table className="map-table">
              <thead><tr><th>Column in your file</th><th>Example</th><th>Goes to</th></tr></thead>
              <tbody>{file.header.map((h, i) => (
                <tr key={i}>
                  <td><b style={{ fontWeight: 600 }}>{h || "Column " + (i + 1)}</b></td>
                  <td className="sample">{file.data.find((r) => r[i]?.trim())?.[i] ?? "—"}</td>
                  <td style={{ width: 260 }}>
                    <select className="in" aria-label={"Rolodex field for " + (h || "column " + (i + 1))} value={map[i] ?? ""} onChange={(e) => setMap(map.map((f, j) => (j === i ? (e.target.value as Field) : f)))}>
                      {FIELDS.map(([v, l]) => <option key={v || "skip"} value={v}>{l}</option>)}
                    </select>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        <div className="card card-pad form-grid">
          <label className="field"><span>Tags for everyone imported <em>optional · comma between</em></span>
            <input className="in" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="LinkedIn, Chamber" /></label>
          {!hasName ? <p className="form-error" role="alert">Pick which column has the name (First name, Last name or Full name).</p> : <div>
            <strong style={{ fontSize: 16 }}>{plural(named.length, "person", "people")} will be imported.</strong>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
              {list.length > named.length && <>{plural(list.length - named.length, "row has", "rows have")} no name and will be skipped. </>}
              People already in your Rolodex (same email) are skipped, so nobody is added twice.
            </p>
          </div>}
          <div className="page-acts">
            <button type="button" className="btn btn-primary btn-lg" disabled={!hasName || !named.length || progress !== null} onClick={go}>
              {progress !== null ? "Importing… " + n(progress) + " of " + n(named.length) : "Import " + plural(named.length, "contact", "contacts")}
            </button>
            <button type="button" className="btn btn-lg" disabled={progress !== null} onClick={reset}>Start over</button>
          </div>
        </div>
      </>}
    </div>
  );
}
