"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Popup, save, toast } from "./ui";
import { Icon } from "./icons";
import { PickOne } from "./activities-parts";
import { useDupes } from "./dupes";
import { AnchoredMenu } from "./anchored-menu";

// Two records for one person or business already in Rolodex (no duplicates): "Merge into…" on the record's ··· menu
// picks the one to keep; everything moves there (contact.merge / company.merge) and this one goes to Recently Deleted.

export type MenuItem = { label: string; icon: string; bad?: boolean; onClick: () => void };

/** The ··· button at the top of a record: a short menu that looks like the right-click one. */
export function MoreMenu({ items, label = "More" }: { items: MenuItem[]; label?: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" className="btn btn-more" aria-label={label} aria-haspopup="menu" aria-expanded={!!anchor} title={label} onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}><Icon name="more" /></button>
      {anchor && (
        <AnchoredMenu anchor={anchor} onClose={() => setAnchor(null)} className="ctx-menu" matchWidth={false} minWidth={200} role="menu" ariaLabel={label}>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.bad ? "is-bad" : undefined} onClick={() => { anchor.focus({ preventScroll: true }); setAnchor(null); it.onClick(); }}><Icon name={it.icon} />{it.label}</button>
          ))}
        </AnchoredMenu>
      )}
    </>
  );
}

/**
 * Merge into…: pick the record to keep (the ones that look like the same person or business first), then everything
 * on this one moves there.
 */
export function MergePopup({ kind, id, name, dupeQuery, options, onClose }: {
  kind: "contact" | "company"; id: number; name: string; dupeQuery: string; options: { id: number; name: string }[]; onClose: () => void;
}) {
  const router = useRouter();
  const { found } = useDupes(dupeQuery);
  const [into, setInto] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const merging = useRef(false);
  const others = options.filter((o) => o.id !== id).map((o) => ({ key: String(o.id), name: o.name }));
  const target = others.find((o) => o.key === into);
  const what = kind === "contact" ? "person" : "company";
  const fromSuggestion = found.some((d) => String(d.id) === into);

  const go = async () => {
    if (!target || merging.current) return;
    merging.current = true;
    setError("");
    setBusy(true);
    const r = await save(kind + ".merge", { from: id, into: Number(target.key) });
    setBusy(false);
    if (!r.ok) {
      merging.current = false;
      setError(r.error ?? "That didn’t merge. Try again.");
      toast(r.error ?? "That didn’t merge.", true);
      return;
    }
    onClose();
    toast(name + " merged into " + target.name);
    // The kept record may already be cached: invalidate it before navigating.
    router.refresh();
    router.push((kind === "contact" ? "/contacts/" : "/companies/") + target.key);
  };

  return (
    <Popup title={"Merge " + name} onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={!target || busy} onClick={go}>{target ? "Merge into " + target.name : "Merge"}</button></>}>
      <div className="form-grid">
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="muted" style={{ margin: 0 }}>
          For two records of the same {what}. Everything on {name} (notes, to-dos, projects, {kind === "contact" ? "companies, connections" : "people"} and emails)
          moves to the one you keep, and details it’s missing are filled in. Then {name} goes to Recently Deleted.
        </p>
        {found.length > 0 && (
          <div className="field"><span>Looks like the same {what}</span>
            <div className="choose-list" role="radiogroup" aria-label={"Same " + what}>
              {found.map((d) => (
                <button key={d.id} type="button" role="radio" aria-checked={into === String(d.id)} className={"search-item" + (into === String(d.id) ? " is-active" : "")} onClick={() => setInto(String(d.id))}>
                  <span className="search-copy"><strong>{d.name}</strong><small>{[d.why, d.sub].filter(Boolean).join(" · ")}</small></span>
                  {into === String(d.id) && <Icon name="check" />}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field"><span>{found.length ? "Or keep another" : "Keep which " + what + "?"}</span>
          <PickOne key={fromSuggestion ? into : "free"} options={others} value={into} onChange={setInto} label={"Keep which " + what} placeholder="Type a name" />
        </div>
      </div>
    </Popup>
  );
}
