"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popup, save, toast, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { ACTIVITY_KINDS, FOLLOW_SHOW_COOKIE, addDays, dayLabel, dueState, initials, stageLabel, today } from "@/lib/format";
import { ReachButtons } from "./reach";
import type { FollowUpItem } from "@/lib/data";

// Follow-ups on anything (a person, a company or a project), the same way everywhere (Brendan 10-15: one-click
// completion and quick scheduling of the next one). The server half is followup.done / followup.set / followup.undo.

export type FollowType = "contact" | "company" | "project";
export const QUICK_DATES: [string, number][] = [["Tomorrow", 1], ["Next week", 7], ["In 2 weeks", 14], ["In a month", 30]];

/**
 * Done in one click: in touch today, follow-up cleared (or moved to `next`), with Undo in the toast. A person with a
 * keep-in-touch rhythm comes back on their own when it's due again. `hold` saves without refreshing the page yet (a
 * row stays put while it asks how); `onUndo` runs when Undo is pressed.
 */
export function useFollowUpDone() {
  const { run } = useSave();
  return async (type: FollowType, id: number, name: string, next = "", o: { hold?: boolean; onUndo?: () => void } = {}) => {
    const r = o.hold ? await save("followup.done", { type, id, next }) : await run("followup.done", { type, id, next });
    if (!r.ok) { if (o.hold) toast(r.error ?? "That didn’t save.", true); return false; }
    toast(next ? "Done · next follow-up " + dayLabel(next) : "Done · " + name, false, () => { o.onUndo?.(); void run("followup.undo", { type, id, was: r.was }, "Put back"); });
    return true;
  };
}

/**
 * "Done, then pick how" (Brendan 10-15): right after Done, Call · Email · Text · Meeting logs that interaction in the
 * record's history, dated today; Skip logs nothing. Either way `onFinish` runs.
 */
const HOW = ["call", "email", "text", "meeting"];
export function HowPicker({ type, id, onFinish }: { type: FollowType; id: number; onFinish: () => void }) {
  const { run, busy } = useSave();
  const log = async (kind: string) => {
    const on = type === "contact" ? "contact_id" : type === "company" ? "company_id" : "opportunity_id";
    if ((await run("note.add", { [on]: id, kind, body: "Followed up", happened_on: today() }, stageLabel(ACTIVITY_KINDS, kind) + " logged")).ok) onFinish();
  };
  return (
    <div className="fu-how" role="group" aria-label="How did you follow up?">
      <span className="muted">How?</span>
      {HOW.map((k) => <button key={k} type="button" className="btn btn-sm" disabled={busy} onClick={() => void log(k)}>{stageLabel(ACTIVITY_KINDS, k)}</button>)}
      <button type="button" className="btn btn-sm btn-quiet" disabled={busy} onClick={onFinish}>Skip</button>
    </div>
  );
}

/** Set (or clear) the next follow-up. */
export function useFollowUpSet() {
  const { run } = useSave();
  return (type: FollowType, id: number, date: string) => run("followup.set", { type, id, date }, date ? "Follow-up set for " + dayLabel(date) : "Follow-up cleared");
}

/** Quick dates plus "Pick a date…", for scheduling the next follow-up from anywhere. */
export function QuickDates({ onPick, current, clear }: { onPick: (date: string) => void; current?: string | null; clear?: boolean }) {
  const t = today();
  return (
    <div className="tags">
      {QUICK_DATES.map(([l, n]) => <button key={l} type="button" className="btn btn-sm" onClick={() => onPick(addDays(t, n))}>{l}</button>)}
      <label className="btn btn-sm date-btn">Pick a date…<input type="date" min={t} value={current ?? ""} onChange={(e) => e.target.value && onPick(e.target.value)} aria-label="Pick a date" /></label>
      {clear && current && <button type="button" className="btn btn-sm btn-quiet" onClick={() => onPick("")}>Clear</button>}
    </div>
  );
}

/** "Done, and follow up again on…": the same Done with the next date picked first. */
export function NextFollowUpPopup({ type, id, name, suggest, onClose }: { type: FollowType; id: number; name: string; suggest?: string; onClose: () => void }) {
  const done = useFollowUpDone();
  const [next, setNext] = useState(suggest ?? "");
  const go = async (date: string) => { if (await done(type, id, name, date)) onClose(); };
  return (
    <Popup title={"Followed up with " + name} onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => go(next)}>{next ? "Done · next " + dayLabel(next) : "Done"}</button></>}>
      <div className="form-grid">
        <p className="muted" style={{ margin: 0 }}>When should you follow up next?</p>
        <QuickDates onPick={(d) => void go(d)} />
        <label className="field"><span>Or pick a date <em>optional</em></span><input className="in" type="date" min={today()} value={next} onChange={(e) => setNext(e.target.value)} /></label>
      </div>
    </Popup>
  );
}

/** "Later": move the follow-up to another day without marking anything done. */
function LaterPopup({ type, id, name, current, onClose }: { type: FollowType; id: number; name: string; current: string | null; onClose: () => void }) {
  const set = useFollowUpSet();
  const go = async (date: string) => { if ((await set(type, id, date)).ok) onClose(); };
  return (
    <Popup title={"Follow up with " + name} onClose={onClose}>
      <div className="form-grid">
        <p className="muted" style={{ margin: 0 }}>{current ? "Now set for " + dayLabel(current) + ". " : ""}When should it come back?</p>
        <QuickDates onPick={(d) => void go(d)} current={current} clear />
      </div>
    </Popup>
  );
}

// ---------------------------------------------------------------- rows: the Dashboard and the Follow-ups page
const KIND = { contact: "contact", company: "company", project: "opportunity" } as const;
const TONE = { late: "is-bad", due: "is-warn", soon: "" } as const;

/** One follow-up: a click anywhere opens the record; Done and Later do their own thing. */
export function FollowUpRow({ item }: { item: FollowUpItem }) {
  const done = useFollowUpDone(), later = useOpen(), router = useRouter();
  // open → busy (saving Done) → how (Done saved; Call · Email · Text · Meeting or Skip) → gone on the next refresh.
  const [stage, setStage] = useState<"open" | "busy" | "how" | "leaving">("open");
  const finish = async () => {
    setStage("busy");
    setStage((await done(item.type, item.id, item.name, "", { hold: true, onUndo: () => setStage("open") })) ? "how" : "open");
  };
  const leave = () => { setStage("leaving"); router.refresh(); };
  // The Later popup sits beside the row, not in it, so the row's click-anywhere styles don't reach its fields.
  return (<>
    <div className={"reach-item fu-row tap" + (stage === "how" ? " is-done" : stage !== "open" ? " is-leaving" : "")} data-kind={KIND[item.type]} data-id={item.id} data-name={item.name}>
      <Link href={item.href} className="tap-link" aria-label={"Open " + item.name} />
      <span className={"avatar" + (item.type === "contact" ? "" : " is-thing")}>{item.type === "contact" ? initials(item.name) : <Icon name={item.type === "company" ? "companies" : "pipeline"} />}</span>
      <span className="reach-copy"><strong>{item.name}</strong>{item.sub && <small>{item.sub}</small>}
        {stage === "how" ? <span className="pill is-ok"><Icon name="check" />Done</span> : <span className={"pill " + TONE[item.tone]}>{item.why}</span>}</span>
      {stage === "how" ? <HowPicker type={item.type} id={item.id} onFinish={leave} /> : (
        <span className="fu-acts">
          <ReachButtons who={{ name: item.type === "project" ? item.contact ?? item.name : item.name, phones: item.phones, emails: item.emails,
            log: item.type === "contact" ? { contact_id: item.id } : item.type === "company" ? { company_id: item.id } : { opportunity_id: item.id, contact_id: item.contact_id, company_id: item.contact_id ? null : item.company_id } }} />
          <button type="button" className="btn btn-sm" disabled={stage !== "open"} onClick={finish}><Icon name="check" />Done</button>
          <button type="button" className="btn btn-sm btn-quiet" disabled={stage !== "open"} onClick={later.show}>Later</button>
        </span>
      )}
    </div>
    {later.open && <LaterPopup type={item.type} id={item.id} name={item.name} current={item.touch ? null : item.due} onClose={later.hide} />}
  </>);
}

export function FollowUpRows({ items }: { items: FollowUpItem[] }) {
  // The key carries the date, so a row that comes back on a new day (a keep-in-touch rhythm) starts fresh.
  return <div className="reach-list">{items.map((i) => <FollowUpRow key={i.type + i.id + i.due} item={i} />)}</div>;
}

export type FollowShow = "all" | FollowType;
const SHOWS: [FollowShow, string][] = [["all", "All"], ["contact", "People"], ["company", "Companies"], ["project", "Projects"]];

/** The Follow-ups page: All · People · Companies · Projects (remembered), then Late, Today, This week, Later. */
export function FollowUpGroups({ items, show: saved }: { items: FollowUpItem[]; show: FollowShow }) {
  const [show, setShow] = useState(saved);
  const pick = (v: FollowShow) => { setShow(v); document.cookie = FOLLOW_SHOW_COOKIE + "=" + v + "; path=/; max-age=31536000; samesite=lax"; };
  const t = today(), week = addDays(t, 7);
  const list = show === "all" ? items : items.filter((i) => i.type === show);
  const groups: [string, string, FollowUpItem[]][] = [
    ["late", "Late", list.filter((i) => i.due < t)],
    ["today", "Today", list.filter((i) => i.due === t)],
    ["week", "This week", list.filter((i) => i.due > t && i.due <= week)],
    ["later", "Later", list.filter((i) => i.due > week)],
  ];
  return (
    <div className="fu-groups">
      <div className="toolbar">
        <div className="chip-pick" role="radiogroup" aria-label="Show">
          {SHOWS.map(([v, l]) => <label key={v}><input type="radio" name="fu-show" checked={show === v} onChange={() => pick(v)} /><span>{l}</span></label>)}
        </div>
      </div>
      {!list.length && <div className="card empty"><strong>Nothing to follow up on.</strong>Set a follow-up or a keep-in-touch rhythm and it shows up here when it’s time.</div>}
      {groups.filter(([, , g]) => g.length).map(([k, label, g]) => (
        <section key={k}>
          <div className={"section-title is-" + k}><h2>{label}</h2><small>{g.length}</small></div>
          <div className="card fu-list"><FollowUpRows items={g} /></div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the Follow-up card on a record's page
/** Done (when there's something to finish) and the quick dates, under a card's follow-up lines. */
export function FollowUpControls({ type, id, name, current, canDone }: { type: FollowType; id: number; name: string; current: string | null; canDone: boolean }) {
  const done = useFollowUpDone(), set = useFollowUpSet();
  const [busy, setBusy] = useState(false), [how, setHow] = useState(false);
  const finish = async () => { setBusy(true); setHow(await done(type, id, name, "", { onUndo: () => setHow(false) })); setBusy(false); };
  return (
    <>
      {how ? <HowPicker type={type} id={id} onFinish={() => setHow(false)} />
        : canDone && <button type="button" className="btn btn-sm btn-primary fu-done" disabled={busy} onClick={finish}><Icon name="check" />Done</button>}
      <QuickDates onPick={(d) => void set(type, id, d)} current={current} clear />
    </>
  );
}

/** A company's or a project's follow-up: when it is, Done in one click, and quick dates for the next one. */
export function FollowUpCard({ type, id, name, next_follow_up }: { type: FollowType; id: number; name: string; next_follow_up: string | null }) {
  const state = dueState(next_follow_up);
  return (
    <div className="card card-pad follow">
      <h3>Follow-up</h3>
      <div className="follow-line"><span>Next follow-up</span><b className={state ? "is-" + state : ""}>{dayLabel(next_follow_up) || "Not set"}</b></div>
      <FollowUpControls type={type} id={id} name={name} current={next_follow_up} canDone={!!next_follow_up} />
    </div>
  );
}
