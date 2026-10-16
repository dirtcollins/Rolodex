-- Rolodex · Phase 2, relationships (2026-10-15; Docs sections 6 and 7), kept simple.
-- Activities: the notes timeline also logs calls, emails, texts, meetings, video calls, LinkedIn messages and
-- introductions (one history per contact, company and project). Network: how two people know each other; who
-- introduced whom to Collins Creative is already contacts.introduced_by.

alter table notes drop constraint notes_kind_check;
alter table notes add constraint notes_kind_check check (kind in ('note', 'observation', 'call', 'email', 'text', 'meeting', 'video', 'linkedin', 'introduction'));
-- When it happened (a call logged afterwards); created_at stays when it was written down.
alter table notes add column happened_at timestamptz;
create index notes_recent on notes (coalesce(happened_at, created_at) desc) where deleted_at is null;

-- Two people who know each other. Stored once; either can be the first. "introduced" and "referred" read
-- "contact_id introduced other_id" / "contact_id referred other_id"; the rest go both ways.
create table relationships (
  id          bigint generated always as identity primary key,
  contact_id  bigint not null references contacts(id),
  other_id    bigint not null references contacts(id),
  kind        text not null default 'knows' check (kind in ('knows', 'introduced', 'referred', 'partner', 'coworker', 'former_coworker', 'family', 'friend')),
  note        text not null default '',
  created_by  bigint references users(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check (contact_id <> other_id)
);
create unique index relationships_pair on relationships (least(contact_id, other_id), greatest(contact_id, other_id), kind) where deleted_at is null;
create index relationships_other on relationships (other_id) where deleted_at is null;
