-- Rolodex · the bell, who did it (2026-10-15), so it can leave out a person's own actions (Light Ops: "not actions I
-- already know I performed"): who moved a project to Won or Lost, and who gave a to-do to its person and when (a to-do
-- handed over later too). Before this, a to-do's giver is the person who made it.
alter table opportunities add column closed_by bigint references users(id);
alter table todos add column assigned_by bigint references users(id);
alter table todos add column assigned_at timestamptz;
update todos set assigned_by = created_by, assigned_at = created_at where assigned_to is not null;
