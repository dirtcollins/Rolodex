"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popup, toast, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { CompanyAvatar } from "./company-avatar";
import { PickOne, type PickOption } from "./activities-parts";
import { FillHint } from "./outreach-parts";
import { LEAD_STAGES, initials, stageLabel } from "@/lib/format";
import type { Campaign, CampaignPerson, Template } from "@/lib/data";

// The client pieces of one campaign's page: the email (with a live preview and Send), the people on its list, Add
// people, Rename and Delete.

export const CAMPAIGN_STATUSES: [string, string][] = [
  ["to_send", "To send"], ["sent", "Sent"], ["replied", "Replied"], ["follow_up", "Follow up"], ["not_interested", "Not interested"], ["skipped", "Skipped"],
];
export type Reachable = { kind: "contact" | "company"; id: number; name: string; sub: string; email: string; tags: string[]; lead_stage: string | null };
type Vars = { first_name: string; name: string; company: string; my_name: string };

/** The same fill-in as the server's (lib/email.ts), for the preview: an unknown one stays as it is, so it's easy to spot. */
const fill = (text: string, v: Record<string, string>) => text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (all, k: string) => (k in v ? v[k] : all));
const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);
const keyOf = (p: { contact_id: number | null; company_id: number | null }) => (p.contact_id ? "p" + p.contact_id : "c" + p.company_id);

/**
 * "The email" (subject and body, saved with Save) beside its preview for the first person on the list, and Send. Send
 * saves first if there are changes, since the server sends what's saved.
 */
export function CampaignEmail({ c, people, templates, vars, previewFor, me, testNote }: {
  c: Campaign; people: CampaignPerson[]; templates: Template[]; vars: Vars | null; previewFor: string; me: { name: string; email: string }; testNote: boolean;
}) {
  const { run, busy } = useSave();
  const [subject, setSubject] = useState(c.subject), [body, setBody] = useState(c.body);
  const dirty = subject !== c.subject || body !== c.body;
  const ready = people.filter((p) => p.status === "to_send" && p.email), noEmail = people.filter((p) => p.status === "to_send" && !p.email).length;
  const confirm = useOpen();

  const saveIt = () => run("campaign.save", { id: c.id, name: c.name, subject, body });
  const copyTemplate = (id: string) => {
    const t = templates.find((x) => String(x.id) === id);
    if (!t) return;
    setSubject(t.subject); setBody(t.body);
    toast(`Copied “${t.name}”. Save to keep it.`);
  };
  const send = async () => {
    if (dirty && !(await saveIt()).ok) return;
    const r = await run("campaign.send", { campaign_id: c.id });
    if (!r.ok) return;
    confirm.hide();
    const [sent = 0, skipped = 0, failed = 0] = r.ids ?? [];
    toast(`Sent ${sent}` + (skipped ? ` (${skipped} had no email)` : "") + (failed ? ` · ${failed} didn’t send` : ""), failed > 0);
  };
  const v = vars ?? undefined;

  return (
    <div className="record">
      <div className="record-main">
        <div className="card card-pad">
          <div className="out-head"><h3>The email</h3>
            {templates.length > 0 && (
              <select className="in out-use" aria-label="Use a template" value="" onChange={(e) => copyTemplate(e.target.value)}>
                <option value="">Use a template…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          <div className="form-grid">
            <label className="field"><span>Subject</span><input className="in" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A quick hello from Collins Creative" /></label>
            <label className="field"><span>Email</span><textarea className="in out-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder={"Hi {{first_name}},\n\n…\n\n{{my_name}}"} /></label>
            <FillHint />
            <div className="out-acts">
              <button type="button" className="btn" disabled={busy || !dirty} onClick={() => saveIt().then((r) => r.ok && toast("Saved"))}>Save</button>
              {dirty && <span className="muted out-note">Not saved yet</span>}
              <span className="grow" />
              <button type="button" className="btn btn-primary" disabled={busy || !ready.length || !subject.trim() || !body.trim()} onClick={confirm.show}>
                <Icon name="outreach" />{ready.length ? "Send to " + plural(ready.length, "person", "people") : "Send"}
              </button>
            </div>
            {!ready.length && <p className="muted out-note" style={{ margin: 0 }}>{people.length ? "No one on the list is waiting to be sent." : "Add people below, then send."}</p>}
            {testNote && <p className="out-test">On this Mac emails go to a test log, not out.</p>}
          </div>
        </div>
      </div>
      <div className="record-side">
        <div className="card card-pad">
          <div className="out-head"><h3>Preview</h3><small>{previewFor ? "for " + previewFor : ""}</small></div>
          <div className="out-preview">
            <strong>{(v ? fill(subject, v) : subject) || <span className="muted">No subject yet</span>}</strong>
            <div className="out-letter">{(v ? fill(body, v) : body) || <span className="muted">Write the email to see it here.</span>}</div>
            <small>{v ? "From " + me.name + ". Your signature goes under it." : "Add people to see it filled in for the first one."}</small>
          </div>
        </div>
      </div>

      {confirm.open && (
        <Popup title={"Send to " + plural(ready.length, "person", "people") + "?"} onClose={confirm.hide}
          foot={<><span className="grow" /><button type="button" className="btn" onClick={confirm.hide}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send now"}</button></>}>
          <div className="form-grid">
            <p style={{ margin: 0 }}>It goes from {me.name} ({me.email}), filled in for each person. Replies come to your inbox.</p>
            <div className="out-to">
              {ready.map((p) => <div key={keyOf(p)}><strong>{p.name}</strong><span className="muted">{p.email}</span></div>)}
            </div>
            {noEmail > 0 && <p className="muted" style={{ margin: 0 }}>{plural(noEmail, "person has", "people have")} no email and will be skipped.</p>}
            {testNote && <p className="out-test">On this Mac emails go to a test log, not out.</p>}
          </div>
        </Popup>
      )}
    </div>
  );
}

/** Who's on the list. A click anywhere on a row opens them; the status and × do only their own thing. */
export function CampaignPeople({ id, people, everyone, tags }: { id: number; people: CampaignPerson[]; everyone: Reachable[]; tags: string[] }) {
  const { run, busy } = useSave();
  const [show, setShow] = useState("");
  const add = useOpen();
  const count = (s: string) => people.filter((p) => p.status === s).length;
  const chips: [string, string, number][] = [["", "All", people.length], ...CAMPAIGN_STATUSES.slice(0, 4).map(([k, l]): [string, string, number] => [k, l, count(k)])];
  const list = show ? people.filter((p) => p.status === show) : people;
  const who = (p: CampaignPerson) => ({ contact_id: p.contact_id ?? undefined, company_id: p.company_id ?? undefined });

  const status = (p: CampaignPerson, s: string) => run("campaign.status", { campaign_id: id, ...who(p), status: s }, p.name + ": " + stageLabel(CAMPAIGN_STATUSES, s));
  const remove = async (p: CampaignPerson) => {
    if (!(await run("campaign.remove", { campaign_id: id, ...who(p) })).ok) return;
    // Undo puts them back where they stood.
    toast("Removed " + p.name, false, async () => {
      if (!(await run("campaign.add", { campaign_id: id, contact_ids: p.contact_id ? [p.contact_id] : [], company_ids: p.company_id ? [p.company_id] : [] })).ok) return;
      if (p.status !== "to_send") await run("campaign.status", { campaign_id: id, ...who(p), status: p.status });
      toast("Back on the list");
    });
  };

  return (
    <div className="card card-pad cp">
      <div className="out-head"><h3>People</h3><button type="button" className="btn btn-sm" onClick={add.show}><Icon name="plus" />Add people</button></div>
      {people.length > 0 && (
        <div className="chip-pick cp-chips" role="radiogroup" aria-label="Show">
          {chips.map(([k, l, n]) => <label key={k}><input type="radio" name="cp-show" checked={show === k} onChange={() => setShow(k)} /><span>{l}<small>{n}</small></span></label>)}
        </div>
      )}
      {!people.length ? <p className="out-empty">No one yet. Add people by tag, lead stage or name.</p>
        : !list.length ? <p className="out-empty">No one is {stageLabel(CAMPAIGN_STATUSES, show)}.</p> : (
        <div className="out-list">
          {list.map((p) => (
            <div key={keyOf(p)} className="cp-row tap">
              <Link className="tap-link" href={p.contact_id ? "/contacts/" + p.contact_id : "/companies/" + p.company_id} aria-label={"Open " + p.name} />
              <span className="who">{p.company_id ? <CompanyAvatar id={p.company_id} name={p.name} /> : <span className="avatar">{initials(p.name)}</span>}
                <span style={{ minWidth: 0 }}><strong>{p.name}</strong><small>{p.sub || (p.company_id ? "Company" : "Person")}</small><small className="cp-mail-sub">{p.email || "No email"}</small></span></span>
              <span className={"cell cp-mail" + (p.email ? "" : " muted")}>{p.email || "No email"}</span>
              <select className={"in cp-status is-" + p.status} aria-label={"Status for " + p.name} value={p.status} disabled={busy} onChange={(e) => status(p, e.target.value)}>
                {CAMPAIGN_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button type="button" className="icon-btn" aria-label={"Remove " + p.name + " from this campaign"} onClick={() => remove(p)}><Icon name="close" /></button>
            </div>
          ))}
        </div>
      )}
      {add.open && <AddPeople id={id} people={people} everyone={everyone} tags={tags} onClose={add.hide} />}
    </div>
  );
}

/**
 * Two ways in, like Add leads: everyone with a tag and/or at a lead stage, or one at a time by name. Only people and
 * companies with an email are offered; ones already on the list stay as they are.
 */
function AddPeople({ id, people, everyone, tags, onClose }: { id: number; people: CampaignPerson[]; everyone: Reachable[]; tags: string[]; onClose: () => void }) {
  const { run, busy } = useSave();
  const [way, setWay] = useState<"list" | "name">("list");
  const on = useMemo(() => new Set(people.map(keyOf)), [people]);
  const k = (r: Reachable) => (r.kind === "contact" ? "p" : "c") + r.id;

  const [tag, setTag] = useState(""), [stage, setStage] = useState("");
  const match = tag || stage ? everyone.filter((r) => (!tag || r.tags.includes(tag)) && (!stage || r.lead_stage === stage)) : [];
  const freshMatch = match.filter((r) => !on.has(k(r)));

  const [picked, setPicked] = useState<Reachable[]>([]), [round, setRound] = useState(0);
  const options = useMemo<PickOption[]>(() => everyone.filter((r) => !on.has(k(r))).map((r) => ({ key: k(r), name: r.name, sub: (r.kind === "company" ? "Company" : r.sub || "Person") + " · " + r.email })), [everyone, on]);
  const pickOne = (key: string) => {
    const r = everyone.find((x) => k(x) === key);
    if (r && !picked.some((x) => k(x) === key)) setPicked([...picked, r]);
    // A fresh, empty picker for the next name (not focused, so its list doesn't cover the ones picked).
    setRound((n) => n + 1);
  };

  const adding = way === "list" ? freshMatch : picked;
  const go = async () => {
    const r = await run("campaign.add", { campaign_id: id, contact_ids: adding.filter((x) => x.kind === "contact").map((x) => x.id), company_ids: adding.filter((x) => x.kind === "company").map((x) => x.id) });
    if (!r.ok) return;
    toast("Added " + plural(adding.length, "person", "people"));
    onClose();
  };

  return (
    <Popup title="Add people" onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={busy || !adding.length} onClick={go}>{adding.length ? "Add " + adding.length : "Add"}</button></>}>
      <div className="form-grid">
        <div className="chip-pick" role="radiogroup" aria-label="How">
          <label><input type="radio" name="add-way" checked={way === "list"} onChange={() => setWay("list")} /><span>By tag or lead stage</span></label>
          <label><input type="radio" name="add-way" checked={way === "name"} onChange={() => setWay("name")} /><span>By name</span></label>
        </div>
        {way === "list" ? (
          <div className="field-row">
            <label className="field"><span>Tagged</span>
              <select className="in" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">Any tag</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></label>
            <label className="field"><span>Lead stage</span>
              <select className="in" value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="">Any stage</option>{LEAD_STAGES.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
              </select></label>
          </div>
        ) : <>
          <div className="field"><span>Person or company</span>
            <PickOne key={round} options={options.filter((o) => !picked.some((x) => k(x) === o.key))} value="" onChange={(key) => key && pickOne(key)} label="Person or company" placeholder={picked.length ? "Add another" : "Type a name"} autoFocus={!round} /></div>
          {picked.length > 0 && (
            <div className="linked">
              {picked.map((x) => (
                <div key={k(x)} className="linked-row">
                  {x.kind === "company" ? <CompanyAvatar id={x.id} name={x.name} /> : <span className="avatar">{initials(x.name)}</span>}
                  <span className="grow"><strong>{x.name}</strong><small>{x.email}</small></span>
                  <button type="button" className="icon-btn" aria-label={"Take off " + x.name} onClick={() => setPicked(picked.filter((y) => y !== x))}><Icon name="close" /></button>
                </div>
              ))}
            </div>
          )}
        </>}
        <p className="muted" style={{ margin: 0 }} aria-live="polite">
          {way === "list" && !tag && !stage ? "Pick a tag or a lead stage. Only people with an email are offered."
            : way === "list" && !match.length ? "No one with an email matches."
            : way === "name" && !picked.length ? "Only people with an email are offered."
            : `${plural(adding.length, "person", "people")} with an email will be added` + (way === "list" && match.length > freshMatch.length ? ` · ${match.length - freshMatch.length} already on the list` : "") + "."}
        </p>
      </div>
    </Popup>
  );
}

/** Rename, in the page head. Subject and body go along as saved, so a rename never touches the email. */
export function RenameCampaign({ c }: { c: Campaign }) {
  const pop = useOpen(), { run, busy } = useSave();
  const [name, setName] = useState(c.name), [error, setError] = useState("");
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name the campaign."); return; }
    const r = await run("campaign.save", { id: c.id, name, subject: c.subject, body: c.body }, "Renamed");
    if (r.ok) pop.hide(); else setError(r.error ?? "");
  };
  return (
    <div className="page-acts">
      <button type="button" className="btn" onClick={() => { setName(c.name); setError(""); pop.show(); }}><Icon name="edit" />Rename</button>
      {pop.open && (
        <Popup title="Rename campaign" onClose={pop.hide}
          foot={<><span className="grow" /><button type="button" className="btn" onClick={pop.hide}>Cancel</button><button type="submit" form="campaign-rename" className="btn btn-primary" disabled={busy}>Save</button></>}>
          <form id="campaign-rename" className="form-grid" onSubmit={go}>
            {error && <p className="form-error" role="alert">{error}</p>}
            <label className="field"><span>Name</span><input className="in" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoFocus /></label>
          </form>
        </Popup>
      )}
    </div>
  );
}

/** A quiet Delete at the bottom of the page. It goes to Recently Deleted; Undo brings it back and reopens it. */
export function DeleteCampaign({ id }: { id: number }) {
  const router = useRouter(), { run, busy } = useSave();
  const go = async () => {
    if (!(await run("campaign.delete", { id })).ok) return;
    router.push("/outreach");
    toast("Campaign deleted", false, async () => {
      if ((await run("restore", { kind: "campaign", id }, "Brought back")).ok) router.push("/outreach/" + id);
    });
  };
  return <button type="button" className="btn btn-danger" disabled={busy} onClick={go}>Delete campaign</button>;
}
