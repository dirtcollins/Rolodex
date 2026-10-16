-- Rolodex · Phase 3, sales (2026-10-15): leads and opportunities (Docs sections 4 and 5).
-- A lead is a company or a person Collins Creative is pursuing before there's a specific project. It points at the
-- existing record (one lead per company or contact), so nobody is entered twice. An opportunity is a specific potential
-- project for a company, with a value and a stage; a company can have several.

create table leads (
  id          bigint generated always as identity primary key,
  company_id  bigint references companies(id),
  contact_id  bigint references contacts(id),
  stage       text not null default 'new' check (stage in ('new', 'researching', 'ready', 'contacted', 'responded', 'meeting', 'qualified', 'not_interested')),
  priority    text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  source      text not null default '',          -- where they came from: Kern 1000 list, referral, website…
  interested  text[] not null default '{}',      -- Collins Creative services they may want
  owner_id    bigint references users(id),
  stage_at    timestamptz not null default now(), -- when it last changed stage
  created_by  bigint references users(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check ((company_id is null) <> (contact_id is null))
);
create unique index leads_company on leads (company_id) where deleted_at is null and company_id is not null;
create unique index leads_contact on leads (contact_id) where deleted_at is null and contact_id is not null;

-- Kept simple on purpose (Brendan, 2026-10-15): company, contact, the project, estimated value, stage, expected close
-- date, next follow-up and notes. "We can always expand later."
create table opportunities (
  id             bigint generated always as identity primary key,
  name           text not null,                   -- the project: "Custom scheduling software"
  company_id     bigint references companies(id),
  contact_id     bigint references contacts(id),  -- the main person on it
  stage          text not null default 'discovery' check (stage in ('discovery', 'qualified', 'meeting', 'proposal_needed', 'proposal_sent', 'negotiating', 'won', 'lost', 'on_hold')),
  value_cents    bigint not null default 0,       -- estimated value
  close_date     date,                            -- expected
  next_follow_up date,
  position       double precision not null default 0, -- order within its stage on the board
  stage_at       timestamptz not null default now(),
  closed_at      timestamptz,                     -- when it became won or lost
  created_by     bigint references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index opportunities_stage on opportunities (stage, position) where deleted_at is null;
create index opportunities_company on opportunities (company_id) where deleted_at is null;

-- Notes and to-dos can be about an opportunity too.
alter table notes add column opportunity_id bigint references opportunities(id);
alter table notes drop constraint notes_check;
alter table notes add constraint notes_about check (contact_id is not null or company_id is not null or opportunity_id is not null);
alter table todos add column opportunity_id bigint references opportunities(id);
