"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Popup, toast, useDelete, useSave } from "./ui";
import { Icon } from "./icons";
import { dayLabel, dueState, when } from "@/lib/format";
import type { Todo } from "@/lib/data";

// One to-do list for every page (To-dos, the Dashboard, a contact's and a company's page): a click anywhere on a to-do
// opens it; the check, its links and Delete do their own thing.

const todoVersions = new Map<number, number>();
type Named = { id: number; name: string };
export type TodoPick = { team: Named[]; contacts: Named[]; companies: Named[]; me: number };

/** New to-do and Edit. A new one is yours unless you pick someone else (or Anyone). */
export function TodoForm({ todo, pick, onClose, about }: { todo?: Todo; pick: TodoPick; onClose: () => void; about?: { contact_id?: number; company_id?: number; opportunity_id?: number } }) {
  const { run, busy } = useSave();
  const del = useDelete();
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), v = (k: string) => String(f.get(k) ?? "");
    if (!v("title").trim()) { setError("Add what needs doing."); return; }
    const r = await run("todo.save", { id: todo?.id, title: v("title"), due: v("due"), high: f.get("high") === "on", assigned_to: v("assigned_to"), contact_id: v("contact_id"), company_id: v("company_id"), opportunity_id: todo?.opportunity_id ?? about?.opportunity_id, notes: v("notes") }, todo ? "Saved" : "To-do added");
    if (r.ok) onClose(); else setError(r.error ?? "");
  };
  return (
    <Popup title={todo ? "Edit to-do" : "New to-do"} onClose={onClose}
      foot={<>{todo && <button type="button" className="btn btn-danger" onClick={() => del("todo", todo.id, onClose)}>Delete</button>}<span className="grow" />
        <button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="todo-form" className="btn btn-primary" disabled={busy}>{todo ? "Save" : "Add to-do"}</button></>}>
      <form id="todo-form" className="form-grid" onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label className="field"><span>What needs doing</span><input className="in" name="title" defaultValue={todo?.title} placeholder="Send Derek the case study" autoFocus /></label>
        <div className="field-row">
          <label className="field"><span>Due <em>optional</em></span><input className="in" type="date" name="due" defaultValue={todo?.due ?? ""} /></label>
          <label className="field"><span>For</span>
            <select className="in" name="assigned_to" defaultValue={String(todo ? todo.assigned_to ?? "" : pick.me)}>
              <option value="">Anyone</option>{pick.team.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
        </div>
        <label className="check"><input type="checkbox" name="high" defaultChecked={todo?.high} /><span>High priority</span></label>
        <div className="field-row">
          <label className="field"><span>About a contact <em>optional</em></span>
            <select className="in" name="contact_id" defaultValue={String(todo?.contact_id ?? about?.contact_id ?? "")}>
              <option value="">No one</option>{pick.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <label className="field"><span>About a company <em>optional</em></span>
            <select className="in" name="company_id" defaultValue={String(todo?.company_id ?? about?.company_id ?? "")}>
              <option value="">None</option>{pick.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
        </div>
        <label className="field"><span>Notes <em>optional</em></span><textarea className="in" name="notes" defaultValue={todo?.notes} /></label>
      </form>
    </Popup>
  );
}

/** One to-do: the whole row opens it (a stretched button under the controls, so it works by keyboard too). */
function TodoRow({ t, pending, toggle, open, remove, hideLinks }: { t: Todo; pending: boolean; toggle: () => void; open: () => void; remove: () => void; hideLinks?: boolean }) {
  const s = t.done_at ? "" : dueState(t.due);
  return (
    <li className={"todo tap" + (t.done_at ? " is-done" : "")} data-kind="todo" data-id={t.id} data-name={t.title}>
      <button type="button" className="tap-link" aria-label={"Open to-do: " + t.title} onClick={open} />
      <button type="button" className="todo-check" disabled={pending} aria-busy={pending} aria-label={t.done_at ? "Mark not done" : "Mark done"} onClick={toggle} />
      <span className="todo-copy">
        <strong>{t.title}</strong>
        {t.notes && <span className="todo-notes">{t.notes}</span>}
        <small>
          {t.done_at ? <span>Done {when(t.done_at)}</span> : t.due && <span className={s ? "is-" + s : ""}>{dayLabel(t.due)}</span>}
          {t.high && <span className="is-due">High</span>}
          {!hideLinks && t.contact_id && <Link href={"/contacts/" + t.contact_id}>{t.contact}</Link>}
          {!hideLinks && t.company_id && <Link href={"/companies/" + t.company_id}>{t.company}</Link>}
          {!hideLinks && t.opportunity_id && t.project && <Link href={"/pipeline/" + t.opportunity_id}>{t.project}</Link>}
          <span>{t.assignee ?? "Anyone"}</span>
        </small>
      </span>
      <button type="button" className="icon-btn" aria-label={"Delete to-do: " + t.title} onClick={remove}><Icon name="deleted" /></button>
    </li>
  );
}

/** A list of to-dos. Checked ones leave the list, so the toast offers Undo. */
export function TodoList({ todos, pick, hideLinks, className = "" }: { todos: Todo[]; pick: TodoPick; hideLinks?: boolean; className?: string }) {
  const { run } = useSave();
  const del = useDelete();
  const [optimistic, setOptimistic] = useState<Record<number, boolean>>({});
  const changes = useRef(new Map<number, { done: boolean; pending: boolean }>());
  const source = useRef(todos);
  source.current = todos;
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Todo | null>(null);
  // Search opens a to-do with ?todo=<id>.
  useEffect(() => {
    const id = Number(new URLSearchParams(location.search).get("todo"));
    const t = id && todos.find((x) => x.id === id);
    if (t) setEditing(t);
  }, [todos]);
  useEffect(() => {
    // A different task's refresh can arrive while this one is saving. Keep the
    // optimistic result until the server actually acknowledges this task.
    let changed = false;
    for (const [id, change] of changes.current) {
      const t = todos.find((x) => x.id === id);
      if (!change.pending && (!t || !!t.done_at === change.done)) {
        changes.current.delete(id);
        changed = true;
      }
    }
    if (changed) setOptimistic(Object.fromEntries([...changes.current].map(([id, value]) => [id, value.done])));
  }, [todos]);
  const setDone = async (t: Todo, done: boolean, offerUndo = true, beforeHint?: boolean) => {
    if (changes.current.get(t.id)?.pending) return;
    const version = (todoVersions.get(t.id) ?? 0) + 1;
    todoVersions.set(t.id, version);
    const before = changes.current.get(t.id)?.done ?? beforeHint ?? !!t.done_at;
    const change = { done, pending: true };
    changes.current.set(t.id, change);
    setPending((old) => new Set(old).add(t.id));
    setOptimistic((old) => ({ ...old, [t.id]: done }));
    const result = await run("todo.done", { id: t.id, done });
    change.pending = false;
    setPending((old) => { const next = new Set(old); next.delete(t.id); return next; });
    if (!result.ok) {
      changes.current.set(t.id, { done: before, pending: false });
      setOptimistic((old) => ({ ...old, [t.id]: before }));
    } else {
      const saved = source.current.find((x) => x.id === t.id);
      if (!saved || !!saved.done_at === done) {
        changes.current.delete(t.id);
        setOptimistic((old) => { const next = { ...old }; delete next[t.id]; return next; });
      }
      if (offerUndo) toast(done ? "Done" : "Back on the list", false, () => {
        // An older toast must not undo a newer action on this task.
        if (todoVersions.get(t.id) !== version || changes.current.get(t.id)?.pending) return;
        void setDone(t, !done, false, done);
      });
    }
  };
  return (
    <>
      <ul className={"todo-list " + className}>
        {todos.map((t) => <TodoRow key={t.id} t={optimistic[t.id] === undefined ? t : { ...t, done_at: optimistic[t.id] ? new Date().toISOString() : null }} pending={pending.has(t.id)} hideLinks={hideLinks} toggle={() => void setDone(t, !(optimistic[t.id] ?? !!t.done_at))} open={() => setEditing(t)} remove={() => del("todo", t.id)} />)}
      </ul>
      {editing && <TodoForm todo={editing} pick={pick} onClose={() => setEditing(null)} />}
    </>
  );
}
