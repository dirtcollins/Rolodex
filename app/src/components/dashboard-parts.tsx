"use client";
import { TodoList, type TodoPick } from "./todos";
import type { Todo } from "@/lib/data";

// The client pieces of the dashboard. (Who should I contact today? is follow-ups.tsx's FollowUpRows.)

/** My open to-dos, checked off right here (the shared list: a click opens one). */
export function DashTodos({ todos, pick }: { todos: Todo[]; pick: TodoPick }) {
  return <TodoList todos={todos} pick={pick} />;
}
