"use client";
import { useRouter } from "next/navigation";
import { useOpen } from "./ui";
import { TodoForm, TodoList, type TodoPick } from "./todos";
import { Icon } from "./icons";
import type { Todo } from "@/lib/data";

// The client pieces of the To-dos page.

export type TodoView = "mine" | "all" | "done";
export type TodoGroup = { key: string; label: string; todos: Todo[] };

/** Mine · Everyone · Done, kept in the address (?view=) so Back and a shared link keep it. */
export function ViewTabs({ view }: { view: TodoView }) {
  const router = useRouter();
  const tabs: [TodoView, string][] = [["mine", "Mine"], ["all", "Everyone"], ["done", "Done"]];
  return (
    <div className="chip-pick" role="radiogroup" aria-label="Show">
      {tabs.map(([v, l]) => (
        <label key={v}><input type="radio" name="view" checked={view === v} onChange={() => router.replace("/todos" + (v === "mine" ? "" : "?view=" + v), { scroll: false })} /><span>{l}</span></label>
      ))}
    </div>
  );
}

export function NewTodo({ pick }: { pick: TodoPick }) {
  const o = useOpen();
  return <><button type="button" className="btn btn-primary" onClick={o.show}><Icon name="plus" />New to-do</button>{o.open && <TodoForm pick={pick} onClose={o.hide} />}</>;
}

/** Groups (Late, Today, Upcoming, No date; or Done). */
export function TodoGroups({ groups, view, pick }: { groups: TodoGroup[]; view: TodoView; pick: TodoPick }) {
  return (
    <>
      {!groups.length && (
        <div className="card empty">{view === "done" ? <><strong>Nothing done yet.</strong>Checked-off to-dos land here.</> : <><strong>Nothing to do.</strong>{view === "mine" ? "Create a to-do, or look at Everyone’s." : "Create your first to-do."}</>}</div>
      )}
      {groups.map((g) => (
        <section key={g.key}>
          <div className={"section-title is-" + g.key}><h2>{g.label}</h2><small>{g.todos.length}</small></div>
          <TodoList todos={g.todos} pick={pick} className="card todo-group" />
        </section>
      ))}
    </>
  );
}
