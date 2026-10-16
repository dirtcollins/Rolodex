-- Fields introduced by the approved V3 interface.  Kept separate so existing
-- installations retain their history and can migrate forward safely.
alter table opportunities add column if not exists owner_id bigint references users(id);
alter table todos add column if not exists position double precision not null default 0;
alter table notes add column if not exists attachments jsonb not null default '[]';
alter table todos add column if not exists subtasks jsonb not null default '[]';
alter table todos add column if not exists comments jsonb not null default '[]';
create index if not exists todos_position on todos (position) where deleted_at is null;
