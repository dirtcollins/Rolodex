"use client";
import { useState } from "react";
import Link from "next/link";
import { Popup, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { PickOne } from "./activities-parts";
import { useRemoveConnection } from "./network-parts";
import { RELATION_KINDS, stageLabel } from "@/lib/format";
import type { Relation } from "@/lib/data";
import { ContactAvatar } from "./contact-avatar";

// A contact's Connections card (Docs: 6. Network): who this person knows, and how. A row opens the other person.

type Named = { id: number; name: string };
const firstName = (name: string) => name.split(/\s+/)[0] || name;

/** The relation as seen from this person's page: "Derek introduced them" / "Introduced Derek", else "Business partner". */
function label(r: Relation, me: string) {
  if (r.kind === "introduced") return r.outgoing ? me + " introduced them" : "Introduced " + me;
  if (r.kind === "referred") return r.outgoing ? me + " referred them" : "Referred " + me;
  return stageLabel(RELATION_KINDS, r.kind);
}

export function RelationshipsCard({ contactId, relations, people }: { contactId: number; relations: Relation[]; people: Named[] }) {
  const add = useOpen(), remove = useRemoveConnection();
  const me = firstName(people.find((p) => p.id === contactId)?.name ?? "They");
  return (
    <div className="card card-pad">
      <h3>Connections</h3>
      {relations.length ? (
        <div className="linked">
          {relations.map((r) => (
            <div key={r.id} className="linked-row tap" data-kind="relationship" data-id={r.id} data-name={r.other}>
              <Link className="tap-link" href={"/contacts/" + r.other_id} aria-label={"Open " + r.other} />
              <ContactAvatar id={r.other_id} name={r.other} />
              <span className="grow">
                <strong>{r.other}</strong>
                <small>{[label(r, me), r.other_sub].filter(Boolean).join(" · ")}</small>
                {r.note && <small style={{ color: "var(--text-2)", overflowWrap: "anywhere" }}>{r.note}</small>}
              </span>
              <button type="button" className="icon-btn" aria-label={"Remove connection to " + r.other} onClick={() => remove(r.id)}><Icon name="close" /></button>
            </div>
          ))}
        </div>
      ) : <p className="muted" style={{ margin: 0 }}>No connections yet. Add who {me === "They" ? "they know" : me + " knows"}.</p>}
      <button type="button" className="btn btn-sm btn-quiet" style={{ marginTop: 10, marginLeft: -13 }} onClick={add.show}><Icon name="plus" />Add connection</button>
      {add.open && <AddPopup contactId={contactId} me={me} people={people.filter((p) => p.id !== contactId)} onClose={add.hide} />}
    </div>
  );
}

/** Add one from this person's side. "Introduced" and "Referred" come both ways, so the order is right. */
function AddPopup({ contactId, me, people, onClose }: { contactId: number; me: string; people: Named[]; onClose: () => void }) {
  const { run, busy } = useSave();
  const [other, setOther] = useState(""), [kind, setKind] = useState("knows"), [note, setNote] = useState(""), [error, setError] = useState("");
  const choices: [string, string][] = RELATION_KINDS.flatMap(([k, l]): [string, string][] =>
    k === "introduced" || k === "referred" ? [[k + ":out", me + " " + k + " them"], [k + ":in", "They " + k + " " + me]] : [[k, l]]);
  const go = async () => {
    if (!other) { setError("Pick who " + me + " knows."); return; }
    const [k, dir] = kind.split(":"), them = Number(other);
    const r = await run("relationship.save", { contact_id: dir === "in" ? them : contactId, other_id: dir === "in" ? contactId : them, kind: k, note }, "Connection added");
    if (r.ok) onClose(); else setError(r.error ?? "");
  };
  return (
    <Popup title="Add connection" onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={go}>Add connection</button></>}>
      <div className="form-grid">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field"><span>Who {me} knows</span><PickOne options={people.map((p) => ({ key: String(p.id), name: p.name }))} value={other} onChange={(k) => { setOther(k); setError(""); }} label={"Who " + me + " knows"} autoFocus /></div>
        <label className="field"><span>How</span>
          <select className="in" value={kind} onChange={(e) => setKind(e.target.value)}>{choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="field"><span>Note <em>optional</em></span><textarea className="in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Old coworkers from the bank; still golf together." /></label>
      </div>
    </Popup>
  );
}
