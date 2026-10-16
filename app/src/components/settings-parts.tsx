"use client";
import { useState } from "react";
import { Popup, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { initials } from "@/lib/format";

// Settings' client pieces: the team (add, edit, turn off) and Collins Creative's services. Owners change them;
// the server checks again (lib/actions.ts), so these buttons are only shown, never trusted.

export type Member = { id: number; name: string; email: string; role: "owner" | "sales"; active: boolean };
const ROLES: [Member["role"], string, string][] = [["owner", "Owner", "Everything, including the team and settings"], ["sales", "Sales", "Contacts, companies, notes and to-dos"]];

export function Team({ members, me, canEdit, minPassword }: { members: Member[]; me: number; canEdit: boolean; minPassword: number }) {
  const add = useOpen();
  const [editing, setEditing] = useState<Member | null>(null);
  return (
    <div className="card card-pad">
      <div className="section-title" style={{ margin: "0 0 6px" }}>
        <h2>Team</h2>
        {canEdit && <button type="button" className="btn btn-sm" onClick={add.show}><Icon name="plus" />Add person</button>}
      </div>
      <div className="reach-list">
        {members.map((m) => (
          <div key={m.id} className={"reach-item" + (canEdit ? " tap" : "")}>
            {canEdit && <button type="button" className="tap-link" aria-label={"Edit " + m.name} onClick={() => setEditing(m)} />}
            <span className="avatar">{initials(m.name)}</span>
            <div className="reach-copy"><strong>{m.name}{m.id === me && <span className="muted" style={{ fontWeight: 400 }}> (you)</span>}</strong><small>{m.email}</small></div>
            <span className={"pill" + (m.role === "owner" ? " is-accent" : "")}>{m.role === "owner" ? "Owner" : "Sales"}</span>
            {!m.active && <span className="pill is-bad">Off</span>}
          </div>
        ))}
      </div>
      {add.open && <MemberForm onClose={add.hide} me={me} minPassword={minPassword} />}
      {editing && <MemberForm member={editing} onClose={() => setEditing(null)} me={me} minPassword={minPassword} />}
    </div>
  );
}

function MemberForm({ member, onClose, me, minPassword }: { member?: Member; onClose: () => void; me: number; minPassword: number }) {
  const { run, busy } = useSave();
  const m = member;
  const [role, setRole] = useState<Member["role"]>(m?.role ?? "sales");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), v = (k: string) => String(f.get(k) ?? "");
    const r = await run("user.save", { id: m?.id, name: v("name"), email: v("email"), role, password: v("password") }, m ? "Saved" : "Added " + v("name").trim());
    if (r.ok) onClose(); else setError(r.error ?? "");
  };
  // Turning an account off signs that person out everywhere; turning it back on lets them sign in again.
  const toggle = async () => { if ((await run("user.active", { id: m!.id, active: !m!.active }, m!.active ? m!.name + " is turned off" : m!.name + " is back on")).ok) onClose(); };
  return (
    <Popup title={m ? "Edit " + m.name : "Add person"} onClose={onClose}
      foot={<>
        {m && m.id !== me && <button type="button" className={"btn" + (m.active ? " btn-danger" : "")} disabled={busy} onClick={toggle}>{m.active ? "Turn off account" : "Turn account back on"}</button>}
        <span className="grow" />
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" form="member-form" className="btn btn-primary" disabled={busy}>{m ? "Save" : "Add person"}</button>
      </>}>
      <form id="member-form" className="form-grid" onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        {m && !m.active && <p className="muted" style={{ margin: 0, fontSize: 14 }}>This account is off. {m.name.split(" ")[0]} can’t sign in until it’s turned back on.</p>}
        <label className="field"><span>Name</span><input className="in" name="name" defaultValue={m?.name ?? ""} autoComplete="off" required /></label>
        <label className="field"><span>Email <em>they sign in with this</em></span><input className="in" type="email" name="email" defaultValue={m?.email ?? ""} autoComplete="off" required /></label>
        <div className="field"><span>Role</span>
          <div className="chip-pick">{ROLES.map(([v, l]) => (
            <label key={v}><input type="radio" name="role" checked={role === v} disabled={m?.id === me} onChange={() => setRole(v)} /><span>{l}</span></label>))}</div>
          <small className="muted" style={{ fontSize: 13 }}>{m?.id === me ? "You can’t change your own role." : ROLES.find(([v]) => v === role)![2] + "."}</small>
        </div>
        <label className="field"><span>{m ? "New password" : "Password"} <em>{m ? "leave blank to keep " + (m.id === me ? "yours" : "theirs") : "at least " + minPassword + " characters"}</em></span>
          <input className="in" type="password" name="password" autoComplete="new-password" minLength={minPassword} required={!m} /></label>
      </form>
    </Popup>
  );
}

/** The Collins Creative services, one per line (they are the choices for a company’s needs). */
export function Services({ services, canEdit }: { services: string[]; canEdit: boolean }) {
 const edit = useOpen(), {run,busy}=useSave();
 const [text,setText]=useState(services.join("\n"));
 const lines=text.split("\n").map(s=>s.trim()).filter(Boolean);
 return <div className="card card-pad"><div className="card-head"><h2>Services</h2>{canEdit&&<button type="button" className="btn btn-sm" onClick={()=>{setText(services.join("\n"));edit.show();}}>Edit services</button>}</div><p className="muted">What Collins Creative helps people with.</p>{services.length?<div className="tags">{services.map(s=><span key={s} className="tag">{s}</span>)}</div>:<p className="muted">No services listed yet.</p>}{edit.open&&<Popup title="Edit services" onClose={edit.hide} foot={<><span className="grow"/><button type="button" className="btn" onClick={edit.hide}>Cancel</button><button type="submit" form="services-form" className="btn btn-primary" disabled={busy}>Save services</button></>}><form id="services-form" className="form-grid" onSubmit={async e=>{e.preventDefault();if((await run("settings.services",{services:lines},"Services saved")).ok)edit.hide();}}><label className="field"><span>Services <em>one per line</em></span><textarea className="in" rows={10} value={text} onChange={e=>setText(e.target.value)} autoFocus/></label></form></Popup>}</div>;
}
