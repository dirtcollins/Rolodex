"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popup, toast, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { when } from "@/lib/format";
import type { SentEmail, Template } from "@/lib/data";

// The client pieces of the Outreach page: New campaign, the templates (new and edit), and Recently sent. The campaign
// page (campaign-parts.tsx) uses the fill-in hint and the status pill too.

/** The fill-ins every email can use; Rolodex fills them for each person when it sends. */
export function FillHint() {
  return <p className="out-hint">Fill-ins: <code>{"{{first_name}}"}</code> <code>{"{{name}}"}</code> <code>{"{{company}}"}</code> <code>{"{{my_name}}"}</code></p>;
}

/** Sent green; a test (this Mac sends to a log) grey; Failed red with the reason on hover. */
export function SendPill({ status, error }: { status: string; error?: string }) {
  if (status === "sent") return <span className="pill is-ok">Sent</span>;
  if (status === "failed") return <span className="pill is-bad" title={error || undefined}>Failed</span>;
  return <span className="pill" title="On this Mac emails go to a test log, not out.">Test (not sent)</span>;
}

/** New campaign: just a name, then its own page to write the email and add people. */
export function NewCampaign() {
  const pop = useOpen();
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={pop.show}><Icon name="plus" />New campaign</button>
      {pop.open && <NewCampaignPopup onClose={pop.hide} />}
    </>
  );
}

function NewCampaignPopup({ onClose }: { onClose: () => void }) {
  const router = useRouter(), { run, busy } = useSave();
  const [name, setName] = useState(""), [error, setError] = useState("");
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name the campaign."); return; }
    const r = await run("campaign.save", { name, subject: "", body: "" });
    if (r.ok && r.id) router.push("/outreach/" + r.id); else setError(r.error ?? "");
  };
  return (
    <Popup title="New campaign" onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="campaign-new" className="btn btn-primary" disabled={busy}>Create</button></>}>
      <form id="campaign-new" className="form-grid" onSubmit={go}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label className="field"><span>Name</span><input className="in" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Kern 1000 intro" autoFocus /></label>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Next you’ll write the email and add who it goes to.</p>
      </form>
    </Popup>
  );
}

/** New template (a page button). */
export function NewTemplate() {
  const pop = useOpen();
  return <><button type="button" className="btn" onClick={pop.show}><Icon name="plus" />New template</button>{pop.open && <TemplateForm onClose={pop.hide} />}</>;
}

/** New and Edit. Delete goes to Recently Deleted, with Undo. */
function TemplateForm({ t, onClose }: { t?: Template; onClose: () => void }) {
  const { run, busy } = useSave();
  const [v, setV] = useState({ name: t?.name ?? "", subject: t?.subject ?? "", body: t?.body ?? "" }), [error, setError] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setV({ ...v, [k]: e.target.value }); setError(""); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) { setError("Name the template."); return; }
    const r = await run("template.save", { id: t?.id, ...v }, t ? "Saved" : "Template added");
    if (r.ok) onClose(); else setError(r.error ?? "");
  };
  const remove = async () => {
    if (!t || !(await run("template.delete", { id: t.id })).ok) return;
    onClose();
    toast("Template deleted", false, () => { void run("restore", { kind: "template", id: t.id }, "Brought back"); });
  };
  return (
    <Popup title={t ? "Edit template" : "New template"} onClose={onClose}
      foot={<>{t && <button type="button" className="btn btn-danger" onClick={remove}>Delete</button>}<span className="grow" />
        <button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="template-form" className="btn btn-primary" disabled={busy}>{t ? "Save" : "Add template"}</button></>}>
      <form id="template-form" className="form-grid" onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label className="field"><span>Name</span><input className="in" value={v.name} onChange={set("name")} placeholder="First intro" autoFocus /></label>
        <label className="field"><span>Subject</span><input className="in" value={v.subject} onChange={set("subject")} placeholder="A quick hello from Collins Creative" /></label>
        <label className="field"><span>Email</span><textarea className="in out-body" value={v.body} onChange={set("body")} placeholder={"Hi {{first_name}},\n\n…\n\n{{my_name}}"} /></label>
        <FillHint />
      </form>
    </Popup>
  );
}

/** The templates. A click anywhere on one opens it. */
export function TemplateRows({ list }: { list: Template[] }) {
  const [editing, setEditing] = useState<Template | null>(null);
  return (
    <>
      <div className="out-list">
        {list.map((t) => (
          <div key={t.id} className="out-item tap">
            <button type="button" className="tap-link" aria-label={"Open template: " + t.name} onClick={() => setEditing(t)} />
            <span className="out-copy"><strong>{t.name}</strong><small>{t.subject || "No subject yet"}</small></span>
          </div>
        ))}
      </div>
      {editing && <TemplateForm t={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Recently sent. A click opens the email as it went out; the name opens the person or company. */
export function SentRows({ list }: { list: SentEmail[] }) {
  const [open, setOpen] = useState<SentEmail | null>(null);
  return (
    <>
      <div className="out-list">
        {list.map((e) => {
          const href = e.contact_id ? "/contacts/" + e.contact_id : e.company_id ? "/companies/" + e.company_id : null;
          return (
            <div key={e.id} className="out-item out-sent tap">
              <button type="button" className="tap-link" aria-label={"Open email: " + e.subject} onClick={() => setOpen(e)} />
              <span className="out-copy">
                {href ? <Link href={href} className="out-who">{e.who ?? e.to_email}</Link> : <strong>{e.who ?? e.to_email}</strong>}
                <small>{e.subject}{e.campaign && <> · {e.campaign}</>}</small>
              </span>
              <SendPill status={e.status} error={e.error} />
              <span className="out-when">{when(e.sent_at)}</span>
            </div>
          );
        })}
      </div>
      {open && <SentPopup e={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function SentPopup({ e, onClose }: { e: SentEmail; onClose: () => void }) {
  return (
    <Popup title={e.subject || "Email"} onClose={onClose} foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Close</button></>}>
      <div className="form-grid">
        <dl className="facts">
          <div><dt>To</dt><dd>{e.who ? `${e.who} · ${e.to_email}` : e.to_email}</dd></div>
          {e.sender && <div><dt>From</dt><dd>{e.sender}</dd></div>}
          <div><dt>When</dt><dd>{when(e.sent_at)}</dd></div>
          {e.campaign && <div><dt>Campaign</dt><dd>{e.campaign}</dd></div>}
          <div><dt>Status</dt><dd><SendPill status={e.status} error={e.error} />{e.status === "failed" && e.error && <span className="muted"> {e.error}</span>}</dd></div>
        </dl>
        <div className="out-letter">{e.body}</div>
      </div>
    </Popup>
  );
}
