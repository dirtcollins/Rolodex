"use client";
import { useState } from "react";
import Link from "next/link";
import { Popup, toast, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { PickOne } from "./activities-parts";
import { RELATION_KINDS } from "@/lib/format";

// The client pieces of the Network page: the connections list and the Add / Edit connection popup.

type Named = { id: number; name: string };
export type Connection = { id: number; kind: string; note: string; a_id: number; a: string; b_id: number; b: string };

/** How a connection reads, first person to second: "Derek introduced Brian", "Jared is a business partner of Mark". */
export const RELATION_WORDS: Record<string, string> = {
  knows: "knows", introduced: "introduced", referred: "referred", partner: "is a business partner of", coworker: "works with",
  former_coworker: "used to work with", family: "is family to", friend: "is friends with",
};

/** Remove a connection, with Undo. */
export function useRemoveConnection() {
  const { run } = useSave();
  return async (id: number, after?: () => void) => {
    if (!(await run("relationship.delete", { id })).ok) return;
    after?.();
    toast("Connection removed", false, () => { void run("restore", { kind: "relationship", id }, "Brought back"); });
  };
}

export function AddConnection({ people }: { people: Named[] }) {
  const o = useOpen();
  return <><button type="button" className="btn btn-primary" onClick={o.show}><Icon name="plus" />Add connection</button>{o.open && <ConnectionForm people={people} onClose={o.hide} />}</>;
}

/** Add or edit how two people know each other. For Introduced and Referred, the order says who did it. */
function ConnectionForm({ conn, people, onClose }: { conn?: Connection; people: Named[]; onClose: () => void }) {
  const { run, busy } = useSave();
  const remove = useRemoveConnection();
  const [a, setA] = useState(conn ? String(conn.a_id) : ""), [b, setB] = useState(conn ? String(conn.b_id) : "");
  const [kind, setKind] = useState(conn?.kind ?? "knows"), [note, setNote] = useState(conn?.note ?? ""), [error, setError] = useState("");
  const options = people.map((p) => ({ key: String(p.id), name: p.name }));
  const nameOf = (k: string) => people.find((p) => String(p.id) === k)?.name;
  const go = async () => {
    if (!a || !b) { setError("Pick both people."); return; }
    const r = await run("relationship.save", { id: conn?.id, contact_id: a, other_id: b, kind, note }, conn ? "Saved" : "Connection added");
    if (r.ok) onClose(); else setError(r.error ?? "");
  };
  return (
    <Popup title={conn ? "Edit connection" : "Add connection"} onClose={onClose}
      foot={<>{conn && <button type="button" className="btn btn-danger" onClick={() => remove(conn.id, onClose)}>Remove</button>}<span className="grow" />
        <button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={go}>{conn ? "Save" : "Add connection"}</button></>}>
      <div className="form-grid">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="field"><span>Person</span><PickOne options={options.filter((o) => o.key !== b)} value={a} onChange={(k) => { setA(k); setError(""); }} label="Person" autoFocus={!conn} /></div>
        <label className="field"><span>How they’re connected</span>
          <select className="in" value={kind} onChange={(e) => setKind(e.target.value)}>
            {RELATION_KINDS.map(([k]) => <option key={k} value={k}>{RELATION_WORDS[k][0].toUpperCase() + RELATION_WORDS[k].slice(1)}</option>)}
          </select></label>
        <div className="field"><span>Who</span><PickOne options={options.filter((o) => o.key !== a)} value={b} onChange={(k) => { setB(k); setError(""); }} label="Who they’re connected to" /></div>
        {nameOf(a) && nameOf(b) && <p className="muted" style={{ margin: 0 }}>{nameOf(a)} {RELATION_WORDS[kind]} {nameOf(b)}.</p>}
        <label className="field"><span>Note <em>optional</em></span><textarea className="in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Met at the Chamber mixer; Brian works with a lot of contractors." /></label>
      </div>
    </Popup>
  );
}

/** Every connection, newest first. A row opens it to edit; the names open those people. */
export function ConnectionList({ connections, people }: { connections: Connection[]; people: Named[] }) {
  const [editing, setEditing] = useState<Connection | null>(null);
  return (
    <>
      <ul className="net-conns">
        {connections.map((c) => (
          <li key={c.id} className="tap">
            <button type="button" className="tap-link" aria-label={"Edit connection: " + c.a + " and " + c.b} onClick={() => setEditing(c)} />
            <span><Link className="link" href={"/contacts/" + c.a_id}>{c.a}</Link> <span className="muted">{RELATION_WORDS[c.kind] ?? c.kind}</span> <Link className="link" href={"/contacts/" + c.b_id}>{c.b}</Link></span>
            {c.note && <small>{c.note}</small>}
          </li>
        ))}
      </ul>
      {editing && <ConnectionForm conn={editing} people={people} onClose={() => setEditing(null)} />}
    </>
  );
}
