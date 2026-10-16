-- Rolodex · simpler pipeline stages (Brendan, 2026-10-15: "Fewer stages"): Lead · Meeting · Proposal sent · Negotiating ·
-- Won · Lost. Existing projects move once: Discovery and Qualified (and On hold) → Lead; Meeting scheduled and Proposal
-- needed → Meeting.
alter table opportunities drop constraint opportunities_stage_check;
update opportunities set stage = 'lead' where stage in ('discovery', 'qualified', 'on_hold');
update opportunities set stage = 'meeting' where stage = 'proposal_needed';
alter table opportunities alter column stage set default 'lead';
alter table opportunities add constraint opportunities_stage_check check (stage in ('lead', 'meeting', 'proposal_sent', 'negotiating', 'won', 'lost'));
