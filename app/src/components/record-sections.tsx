"use client";
import { useEffect, useId, useState } from "react";

type Section = { id: string; label: string; content: React.ReactNode };
/** Record sections stay in the full page; hashes make each section linkable without a data reload. */
export function RecordSections({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0].id), uid = useId();
  useEffect(() => {
    const sync = () => { const id = location.hash.slice(1); setActive(sections.some((s) => s.id === id) ? id : sections[0].id); };
    sync(); addEventListener("hashchange", sync); addEventListener("popstate", sync);
    return () => { removeEventListener("hashchange", sync); removeEventListener("popstate", sync); };
  }, [sections]);
  const choose = (id: string) => { setActive(id); history.replaceState(null, "", location.pathname + location.search + "#" + id); dispatchEvent(new HashChangeEvent("hashchange")); };
  return <div className="record-sections">
    <div className="section-tabs" role="tablist" aria-label="Record sections">{sections.map((s, i) => <button key={s.id} id={uid + s.id + '-tab'} role="tab" type="button" aria-selected={active === s.id} aria-controls={uid + s.id} tabIndex={active === s.id ? 0 : -1} onClick={() => choose(s.id)} onKeyDown={(e) => {
      const next = e.key === 'ArrowRight' ? (i + 1) % sections.length : e.key === 'ArrowLeft' ? (i - 1 + sections.length) % sections.length : e.key === 'Home' ? 0 : e.key === 'End' ? sections.length - 1 : -1;
      if (next >= 0) { e.preventDefault(); choose(sections[next].id); document.getElementById(uid + sections[next].id + '-tab')?.focus(); }
    }}>{s.label}</button>)}</div>
    {sections.map((s) => <section key={s.id} id={uid + s.id} role="tabpanel" aria-labelledby={uid + s.id + '-tab'} hidden={active !== s.id} tabIndex={0} className="record-section">{s.content}</section>)}
  </div>;
}
