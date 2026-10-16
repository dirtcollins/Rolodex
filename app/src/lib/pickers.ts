import "server-only";
import { cache } from "react";
import { allTags, companyNames, contactNames, team } from "./data";
import type { Pickers } from "@/components/contact-form";
import type { TodoPick } from "@/components/todos";

/** What the contact form's pickers offer. */
export const pickers = cache(async (): Promise<Pickers> => {
  const [companies, contacts, people, tags] = await Promise.all([companyNames(), contactNames(), team(), allTags()]);
  return { companies, contacts, team: people, tags };
});
/** The to-do form's choices (a new to-do is `me`'s). */
export const todoPick = (p: Pickers, me: number): TodoPick => ({ team: p.team, contacts: p.contacts, companies: p.companies, me });
