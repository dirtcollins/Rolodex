-- Rolodex · the bell (Light Ops 2.0's, brought over 2026-10-15). Notifications are worked out live from the real
-- records every time (app/src/lib/bell.ts: follow-ups and to-dos due, and what teammates did), never stored. What is
-- kept is only what each person has read or dismissed, by the item's stable id ("todo-7", "note-12"), never rewritten.
-- Per person (Light Ops 060: one person's Mark all read never marks anyone else's).
create table bell_reads (
  user_id  bigint not null references users(id),
  note_id  text not null,
  read_at  timestamptz not null default now(),
  primary key (user_id, note_id)
);

-- The X on a bell row, and Clear all (Light Ops 041). A dismissed one only stays gone; something new has a new id and
-- shows. Dismissing never touches the contact, company, project, note or to-do it's about. Separate from "read".
create table bell_dismissals (
  user_id  bigint not null references users(id),
  note_id  text not null,
  at       timestamptz not null default now(),
  primary key (user_id, note_id)
);
