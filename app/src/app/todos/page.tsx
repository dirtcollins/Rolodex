import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { companyNames, contactNames, listTodos, team } from "@/lib/data";
import { today } from "@/lib/format";
import { NewTodo, TodoGroups, ViewTabs, type TodoGroup, type TodoView } from "@/components/todos-page";
import { SelectButton } from "@/components/record-menu";
import "./todos.css";

export const metadata = { title: "To-dos · Rolodex" };

// To-dos (Docs: 7. Activities, follow-up tools): tasks with due dates, priority and who it's for. Mine (with the ones
// nobody has taken), Everyone, and Done.
export default async function Todos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await session();
  if (!s) redirect("/login");
  const sp = await searchParams;
  const view: TodoView = sp.view === "all" || sp.view === "done" ? sp.view : "mine";
  const [todos, people, contacts, companies] = await Promise.all([
    listTodos({ done: view === "done", mine: view === "mine" ? s.user.id : undefined }), team(), contactNames(), companyNames(),
  ]);
  const t = today();
  // Open ones come sorted by due date, so each group keeps that order; done ones are newest first.
  const groups: TodoGroup[] = view === "done" ? [{ key: "done", label: "Done", todos }] : [
    { key: "late", label: "Late", todos: todos.filter((x) => x.due && x.due < t) },
    { key: "today", label: "Today", todos: todos.filter((x) => x.due === t) },
    { key: "upcoming", label: "Upcoming", todos: todos.filter((x) => x.due && x.due > t) },
    { key: "none", label: "No date", todos: todos.filter((x) => !x.due) },
  ];
  const pick = { team: people, contacts, companies, me: s.user.id };
  return (
    <>
      <div className="page-head"><div><h1>To-dos</h1></div><div className="page-acts"><SelectButton kind="todo" /><NewTodo pick={pick} /></div></div>
      <div className="toolbar"><ViewTabs view={view} /></div>
      <TodoGroups groups={groups.filter((g) => g.todos.length)} view={view} pick={pick} />
    </>
  );
}
