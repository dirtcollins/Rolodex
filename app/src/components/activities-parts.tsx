"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { AnchoredMenu } from "./anchored-menu";
import { Popup, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { PROMPTS } from "./record-parts";
import { ACTIVITY_KINDS, INTERACTIONS, today } from "@/lib/format";

// The client pieces of the Activities page, and the type-to-find picker its popups (and the Network's) share.

export type PickOption = { key: string; name: string; sub?: string; icon?: string };

/**
 * Pick one from a long list by typing part of a name (a plain select is too long once the Rolodex fills up).
 * Arrow keys and Enter work; typing again clears the pick until a new one is chosen.
 */
export function PickOne({ options, value, onChange, label, placeholder, autoFocus }: { options: PickOption[]; value: string; onChange: (key: string) => void; label: string; placeholder?: string; autoFocus?: boolean }) {
  const input = useRef<HTMLInputElement>(null), listId = useId();
  const picked = options.find((o) => o.key === value);
  const [q, setQ] = useState(picked?.name ?? ""), [open, setOpen] = useState(false), [at, setAt] = useState(0);
  // Showing the picked name isn't a search: open it and every option is there again.
  const t = picked && q === picked.name ? "" : q.trim().toLowerCase();
  const hits = !open ? [] : options.filter((o) => !t || o.name.toLowerCase().includes(t))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(t)) - Number(!b.name.toLowerCase().startsWith(t)));
  const choose = (o: PickOption) => { input.current?.dispatchEvent(new CustomEvent("rx-draft-change", { bubbles: true })); onChange(o.key); setQ(o.name); setOpen(false); };
  useLayoutEffect(() => { if (open) document.getElementById(listId + "-" + at)?.scrollIntoView({ block: "nearest" }); }, [open, at, listId]);
  return (
    <div className="pick">
      <input ref={input} className="in" role="combobox" aria-label={label} aria-expanded={open && (hits.length > 0 || !!t)} aria-controls={open ? listId : undefined} aria-activedescendant={open && hits[at] ? listId + "-" + at : undefined} aria-autocomplete="list" autoComplete="off" autoFocus={autoFocus}
        value={q} placeholder={placeholder ?? "Type a name"}
        // The list opens on a click, typing or ↓, not on focus: a popup that focuses it first stays uncovered.
        onClick={() => setOpen(true)} onBlur={event => { if (!(event.relatedTarget as HTMLElement | null)?.closest(`[id="${listId}"]`)) setOpen(false); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setAt(0); if (value) onChange(""); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setAt((a) => open ? Math.min(a + 1, Math.max(0, hits.length - 1)) : 0); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAt((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && open && hits[at]) { e.preventDefault(); choose(hits[at]); }
          // The first Escape closes the list, not the popup.
          else if (e.key === "Escape" && open && hits.length) { e.stopPropagation(); setOpen(false); }
        }} />
      {open && (hits.length > 0 || t) && (
        <AnchoredMenu anchor={input.current} onClose={() => setOpen(false)} className="pick-list" role="listbox" id={listId} ariaLabel={label}>
          {hits.length ? hits.map((o, i) => (
            <button key={o.key} id={listId + "-" + i} type="button" role="option" aria-selected={i === at} className={"search-item" + (i === at ? " is-active" : "")}
              onPointerDown={(e) => e.preventDefault()} onMouseEnter={() => setAt(i)} onClick={() => choose(o)}>
              <span className="search-ico"><Icon name={o.icon ?? (o.sub === "Company" ? "buildings" : "person")} /></span><span className="search-copy"><strong>{o.name}</strong>{o.sub && <small>{o.sub}</small>}</span>
            </button>
          )) : <p className="search-empty">Nothing matches “{q.trim()}”.</p>}
        </AnchoredMenu>
      )}
    </div>
  );
}

type Named = { id: number; name: string };

/** "Log activity": a call, email, meeting… with a person or a company, on the day it happened. */
export function LogActivity({ contacts, companies }: { contacts: Named[]; companies: Named[] }) {
  const o = useOpen();
  return <><button type="button" className="btn btn-primary" onClick={o.show}><Icon name="plus" />Log activity</button>{o.open && <LogPopup contacts={contacts} companies={companies} onClose={o.hide} />}</>;
}

function LogPopup({ contacts, companies, onClose }: { contacts: Named[]; companies: Named[]; onClose: () => void }) {
  const { run, busy } = useSave();
  const [about, setAbout] = useState(""), [kind, setKind] = useState("call"), [on, setOn] = useState(today()), [body, setBody] = useState(""), [error, setError] = useState("");
  const options: PickOption[] = [...contacts.map((c) => ({ key: "p" + c.id, name: c.name, sub: "Person" })), ...companies.map((c) => ({ key: "c" + c.id, name: c.name, sub: "Company" }))];
  const company = about.startsWith("c");
  // Observations are about a business (what we noticed it needs), so they're offered for a company only.
  const kinds = ACTIVITY_KINDS.filter(([k]) => k !== "observation" || company);
  const go = async () => {
    if (!about) { setError("Pick who it’s about."); return; }
    if (!body.trim()) { setError("Write what happened."); return; }
    const id = Number(about.slice(1)), k = kinds.some(([x]) => x === kind) ? kind : "note";
    const r = await run("note.add", { contact_id: company ? undefined : id, company_id: company ? id : undefined, kind: k, body, happened_on: INTERACTIONS.includes(k) ? on : "" }, "Logged");
    if (r.ok) onClose(); else setError(r.error ?? "");
  };
  return (
    <Popup title="Log activity" onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={go}>Log it</button></>}>
      <div className="form-grid">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field"><span>Who it’s about</span><PickOne options={options} value={about} onChange={(k) => { setAbout(k); setError(""); }} label="Who it’s about" placeholder="Type a person or company" autoFocus /></div>
        <div className="field"><span>What happened</span>
          <div className="chip-pick" role="radiogroup" aria-label="What happened">
            {kinds.map(([k, l]) => <label key={k}><input type="radio" name="log-kind" checked={kind === k} onChange={() => setKind(k)} /><span>{l}</span></label>)}
          </div>
        </div>
        {INTERACTIONS.includes(kind) && <label className="field"><span>When</span><input className="in" type="date" value={on} max={today()} onChange={(e) => setOn(e.target.value)} /></label>}
        <label className="field"><span>Details</span><textarea className="in" value={body} onChange={(e) => { setBody(e.target.value); setError(""); }} placeholder={PROMPTS[kind] ?? "What happened?"}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void go(); } }} /></label>
      </div>
    </Popup>
  );
}
