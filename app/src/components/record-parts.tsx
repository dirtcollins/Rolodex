"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Popup, useDelete, useOpen, useSave } from "./ui";
import { Icon } from "./icons";
import { ContactForm, type Pickers } from "./contact-form";
import { TodoForm, TodoList, type TodoPick } from "./todos";
import { FollowUpControls, QUICK_DATES } from "./follow-ups";
import { MergePopup, MoreMenu } from "./merge";
import { contactQuery } from "./dupes";
import { ACTIVITY_KINDS, CADENCES, INTERACTIONS, addDays, dayLabel, dueState, noteWhen, stageLabel, today } from "@/lib/format";

/** What the box asks for, by what happened (the Activities page's Log activity too). */
export const PROMPTS: Record<string, string> = {
  note: "Add a note…", observation: "What you noticed: still schedules on a spreadsheet, website is outdated…", call: "What did you talk about?",
  email: "What was it about?", text: "What did you text about?", meeting: "Who was there and what came of it?", video: "What did you cover?",
  linkedin: "What was the message?", introduction: "Who introduced whom, and why?",
};
const kindWord = (k: string) => stageLabel(ACTIVITY_KINDS, k).toLowerCase().replace("linkedin", "LinkedIn message");
import type { Contact, Note, Todo } from "@/lib/data";

// The client pieces of a contact's and a company's page.

/** Log a touch · Edit · ··· (Merge into…, Delete), at the top of a contact. */
export function ContactActions({ contact, pickers }: { contact: Contact; pickers: Pickers }) {
  const edit = useOpen(), touch = useOpen(), merge = useOpen();
  const router = useRouter(), del = useDelete();
  const c = contact;
  return (
    <div className="page-acts">
      <button type="button" className="btn btn-primary" onClick={touch.show}><Icon name="touch" />Log a touch</button>
      <button type="button" className="btn" onClick={edit.show}><Icon name="edit" />Edit</button>
      <MoreMenu items={[
        { label: "Merge into…", icon: "merge", onClick: merge.show },
        { label: "Delete", icon: "deleted", bad: true, onClick: () => del("contact", c.id, () => router.push("/contacts")) },
      ]} />
      {edit.open && <ContactForm contact={c} pickers={pickers} onClose={edit.hide} />}
      {touch.open && <TouchPopup contact={c} onClose={touch.hide} />}
      {merge.open && <MergePopup kind="contact" id={c.id} name={c.name} options={pickers.contacts} onClose={merge.hide}
        dupeQuery={contactQuery({ first: c.first_name, last: c.last_name, emails: c.emails.map((x) => x.value), phones: c.phones.map((x) => x.value), not: c.id })} />}
    </div>
  );
}

/**
 * Log a touch: "we were in touch today". How (call, email…) and an optional note go on the timeline, so the history
 * reads "Call · Today"; the follow-up is done, or set to the next date (suggested from their keep-in-touch rhythm).
 */
export function TouchPopup({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const { run, busy } = useSave();
  const suggest = contact.keep_in_touch ? addDays(today(), contact.keep_in_touch) : "";
  const [next, setNext] = useState(suggest), [note, setNote] = useState(""), [kind, setKind] = useState("call");
  const go = async () => { if ((await run("contact.touch", { id: contact.id, kind, note, next_follow_up: next }, "Logged")).ok) onClose(); };
  return (
    <Popup title={"In touch with " + (contact.first_name || contact.name)} onClose={onClose}
      foot={<><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={go}>Log it</button></>}>
      <div className="form-grid">
        <div className="chip-pick" role="radiogroup" aria-label="How">
          {ACTIVITY_KINDS.filter(([k]) => INTERACTIONS.includes(k) && k !== "introduction").map(([k, label]) => (
            <label key={k}><input type="radio" name="touch-kind" checked={kind === k} onChange={() => setKind(k)} /><span>{label}</span></label>))}
        </div>
        <label className="field"><span>What happened <em>optional</em></span><textarea className="in" value={note} onChange={(e) => setNote(e.target.value)} placeholder={PROMPTS[kind]} autoFocus /></label>
        <div className="field"><span>Next follow-up <em>{contact.keep_in_touch ? "from their keep-in-touch rhythm" : "optional"}</em></span>
          <input className="in" type="date" min={today()} value={next} onChange={(e) => setNext(e.target.value)} aria-label="Next follow-up" />
          <div className="tags">{QUICK_DATES.map(([l, n]) => <button key={l} type="button" className="btn btn-sm" onClick={() => setNext(addDays(today(), n))}>{l}</button>)}
            {next && <button type="button" className="btn btn-sm btn-quiet" onClick={() => setNext("")}>Clear</button>}</div>
        </div>
      </div>
    </Popup>
  );
}

/** Follow-up and keep-in-touch on a person: when, Done in one click, quick dates, and their rhythm. */
export function FollowUp({ contact }: { contact: Contact }) {
  const t = today(), state = dueState(contact.next_follow_up), k = contact.keep_in_touch;
  const keepDue = k ? (contact.last_contacted ? addDays(contact.last_contacted, k) : t) : null, keepState = dueState(keepDue);
  return (
    <div className="card card-pad follow">
      <h3>Follow-up</h3>
      <div className="follow-line"><span>Next follow-up</span><b className={state ? "is-" + state : ""}>{dayLabel(contact.next_follow_up) || "Not set"}</b></div>
      <div className="follow-line"><span>Last in touch</span><b>{dayLabel(contact.last_contacted) || "Never logged"}</b></div>
      <div className="follow-line"><span>Keep in touch</span><b>{k ? CADENCES.find(([d]) => d === k)?.[1] ?? "Every " + k + " days" : "Not set"}</b></div>
      {keepDue && <div className="follow-line"><span>Reconnect by</span><b className={keepState ? "is-" + keepState : ""}>{dayLabel(keepDue)}</b></div>}
      <FollowUpControls type="contact" id={contact.id} name={contact.name} current={contact.next_follow_up} canDone={!!contact.next_follow_up || !!keepState} />
    </div>
  );
}

/**
 * The timeline (Docs: "a unified history of interactions"): notes, observations, and calls, emails, texts, meetings,
 * video calls, LinkedIn messages and introductions, each on the day it happened. Logging an interaction with a person
 * counts as being in touch. A company's shows its people's too.
 */
export function Timeline({ notes, contactId, companyId, opportunityId, observations }: { notes: Note[]; contactId?: number; companyId?: number; opportunityId?: number; observations?: boolean }) {
 const {run,busy}=useSave(),del=useDelete(),addPopup=useOpen();
 const [body,setBody]=useState(""),[kind,setKind]=useState("note"),[on,setOn]=useState(today()),[editing,setEditing]=useState<Note|null>(null),[draft,setDraft]=useState(""),[visible,setVisible]=useState(20);
 const moreActivity=useRef<HTMLDivElement>(null);
 useEffect(()=>{setVisible(20);},[contactId,companyId,opportunityId]);
 useEffect(()=>{
   const sentinel=moreActivity.current;
   if(!sentinel||visible>=notes.length)return;
   if(!("IntersectionObserver" in window)){setVisible(notes.length);return;}
   const observer=new IntersectionObserver(entries=>{
     if(entries.some(entry=>entry.isIntersecting)){
       observer.disconnect();
       setVisible(count=>Math.min(count+20,notes.length));
     }
   },{rootMargin:"400px 0px"});
   observer.observe(sentinel);
   return()=>observer.disconnect();
 },[visible,notes.length]);
 const add=async(e:React.FormEvent)=>{e.preventDefault();if(!body.trim())return;if((await run("note.add",{contact_id:contactId,company_id:companyId,opportunity_id:opportunityId,body,kind,happened_on:INTERACTIONS.includes(kind)?on:""},"Activity added")).ok){setBody("");setKind("note");setOn(today());addPopup.hide();}};
 return <div className="card card-pad"><div className="card-head"><h3>Activity</h3><button type="button" className="btn btn-primary" onClick={addPopup.show}><Icon name="plus"/>Add activity</button></div>
 {!notes.length?<div className="empty"><strong>No activity yet.</strong>Keep a note of your next conversation.</div>:<ul className="timeline">{notes.slice(0,visible).map(n=><li key={n.id} className={"tap is-"+n.kind} data-kind="note" data-id={n.id} data-name={n.body.slice(0,40)}><button type="button" className="tap-link" aria-label="Open activity" onClick={()=>{setEditing(n);setDraft(n.body);}}/><div className="timeline-meta">{n.kind!=="note"&&<span className={"pill "+(n.kind==="observation"?"is-warn":"is-accent")}>{stageLabel(ACTIVITY_KINDS,n.kind)}</span>}{n.about&&n.contact_id&&n.contact_id!==contactId&&<Link className="link" href={"/contacts/"+n.contact_id}>{n.about}</Link>}{n.project&&n.opportunity_id&&n.opportunity_id!==opportunityId&&<Link className="link" href={"/pipeline/"+n.opportunity_id}>{n.project}</Link>}<span>{noteWhen(n)}{n.author?" · "+n.author:""}</span><span className="timeline-acts"><button type="button" className="icon-btn" aria-label="Edit note" onClick={()=>{setEditing(n);setDraft(n.body);}}><Icon name="edit"/></button><button type="button" className="icon-btn" aria-label="Delete note" onClick={()=>del("note",n.id)}><Icon name="deleted"/></button></span></div><div className="timeline-body">{n.body}</div></li>)}</ul>}
 {notes.length>visible&&<div ref={moreActivity} className="timeline-sentinel" aria-hidden="true" style={{height:1}}/>}
 {addPopup.open&&<Popup title="Add activity" onClose={addPopup.hide} foot={<><span className="grow"/><button type="button" className="btn" onClick={addPopup.hide}>Cancel</button><button type="submit" form="record-activity" className="btn btn-primary" disabled={busy||!body.trim()}>Save activity</button></>}><form id="record-activity" className="form-grid" onSubmit={add}><label className="field"><span>What happened</span><select className="in" value={kind} onChange={e=>setKind(e.target.value)}>{ACTIVITY_KINDS.filter(([k])=>k!=="observation"||observations).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>{INTERACTIONS.includes(kind)&&<label className="field"><span>When</span><input className="in" type="date" value={on} max={today()} onChange={e=>setOn(e.target.value)}/></label>}<label className="field"><span>Details</span><textarea className="in" rows={5} autoFocus value={body} onChange={e=>setBody(e.target.value)} placeholder={PROMPTS[kind]}/></label></form></Popup>}
 {editing&&<Popup title="Edit activity" onClose={()=>setEditing(null)} foot={<><span className="grow"/><button type="button" className="btn" onClick={()=>setEditing(null)}>Cancel</button><button type="submit" form="edit-activity" className="btn btn-primary" disabled={busy||!draft.trim()}>Save changes</button></>}><form id="edit-activity" onSubmit={async e=>{e.preventDefault();if((await run("note.save",{id:editing.id,body:draft},"Activity saved")).ok)setEditing(null);}}><label className="field"><span>Details</span><textarea className="in" rows={6} value={draft} onChange={e=>setDraft(e.target.value)} autoFocus/></label></form></Popup>}
 </div>;
}

export function RecordTodos({ todos, pick, contactId, companyId, opportunityId }: { todos: Todo[]; pick: TodoPick; contactId?: number; companyId?: number; opportunityId?: number }) {
 const o=useOpen();
 return <div className="card card-pad"><div className="card-head"><h3>To-dos</h3><button type="button" className="btn btn-sm" onClick={o.show}><Icon name="plus"/>New to-do</button></div>{todos.length?<TodoList todos={todos} pick={pick} hideLinks/>:<p className="muted" style={{margin:0}}>Nothing to do.</p>}{o.open&&<TodoForm pick={pick} about={{contact_id:contactId,company_id:companyId,opportunity_id:opportunityId}} onClose={o.hide}/>}</div>;
}
