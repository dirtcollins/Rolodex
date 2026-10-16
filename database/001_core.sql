-- Rolodex · Phase 1 (Brendan, 2026-10-15): the people who sign in, contacts, companies, the notes timeline and
-- to-dos. Contacts and companies are the two central records; everything else points at them
-- (Docs/Rolodex_Software_Features.md, "Core Data Architecture").

-- ---------------------------------------------------------------- who signs in
-- One table for everyone: Brendan and Nathan (owners) and salespeople. Everyone sees the whole Rolodex; only owners
-- manage the team. session_version moves on to sign an account out everywhere (a new password, turned off).
create table users (
  id              bigint generated always as identity primary key,
  name            text not null,
  email           text not null,
  phone           text not null default '',
  role            text not null default 'sales' check (role in ('owner', 'sales')),
  password_hash   text not null default '',
  active          boolean not null default true,
  session_version int not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index users_email on users (lower(email));

-- Sign-in tries per IP (8 per 15 minutes).
create table rate_hits (id bigint generated always as identity primary key, bucket text not null, at timestamptz not null default now());
create index rate_hits_bucket on rate_hits (bucket, at);

create table settings (key text primary key, value text not null default '');

-- ---------------------------------------------------------------- companies (the business directory)
create table companies (
  id            bigint generated always as identity primary key,
  name          text not null,
  industry      text not null default '',
  description   text not null default '',
  website       text not null default '',
  phone         text not null default '',
  email         text not null default '',
  street        text not null default '',
  city          text not null default '',
  state         text not null default '',
  zip           text not null default '',
  linkedin      text not null default '',
  socials       text not null default '',          -- other profile links, one per line
  size          text not null default '',          -- "1–10", "11–50"…
  revenue       text not null default '',          -- estimated, free text
  tech          text not null default '',          -- existing software and technology
  needs         text[] not null default '{}',      -- Collins Creative services they may need
  tags          text[] not null default '{}',
  owner_id      bigint references users(id),       -- who on the team looks after them
  next_follow_up date,
  created_by    bigint references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index companies_name on companies (lower(name)) where deleted_at is null;

-- ---------------------------------------------------------------- contacts (the Rolodex)
-- A person stays one record as they move from connection to lead to client to referral partner (kinds).
create table contacts (
  id               bigint generated always as identity primary key,
  first_name       text not null default '',
  last_name        text not null default '',
  job_title        text not null default '',
  kinds            text[] not null default '{}',   -- prospect, client, former_client, referral_partner, vendor, friend, connection
  phones           jsonb not null default '[]',    -- [{label, value}]
  emails           jsonb not null default '[]',    -- [{label, value}]
  website          text not null default '',
  linkedin         text not null default '',
  socials          text not null default '',
  city             text not null default '',
  state            text not null default '',
  birthday         date,
  how_met          text not null default '',
  introduced_by    bigint references contacts(id),
  tags             text[] not null default '{}',
  owner_id         bigint references users(id),
  last_contacted   date,                           -- the last time someone on the team was in touch
  next_follow_up   date,
  keep_in_touch    int check (keep_in_touch in (30, 60, 90, 180)), -- days between touches, even with nothing to sell
  created_by       bigint references users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  check (first_name <> '' or last_name <> '')
);
create index contacts_name on contacts (lower(first_name), lower(last_name)) where deleted_at is null;

-- A person can be at several companies (an owner of two businesses, a board seat). Removing the link never removes either.
create table contact_companies (
  contact_id  bigint not null references contacts(id),
  company_id  bigint not null references companies(id),
  title       text not null default '',             -- their role there, when it differs from job_title
  primary key (contact_id, company_id)
);
create index contact_companies_company on contact_companies (company_id);

-- ---------------------------------------------------------------- the timeline
-- Dated notes on a contact or a company (Phase 1). Later phases add calls, emails, meetings and introductions as
-- more kinds on the same timeline. An observation is company intelligence ("still schedules on a spreadsheet").
create table notes (
  id          bigint generated always as identity primary key,
  contact_id  bigint references contacts(id),
  company_id  bigint references companies(id),
  kind        text not null default 'note' check (kind in ('note', 'observation')),
  body        text not null,
  author_id   bigint references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check (contact_id is not null or company_id is not null)
);
create index notes_contact on notes (contact_id, created_at desc) where deleted_at is null;
create index notes_company on notes (company_id, created_at desc) where deleted_at is null;

-- ---------------------------------------------------------------- to-dos and follow-ups
create table todos (
  id          bigint generated always as identity primary key,
  title       text not null,
  notes       text not null default '',
  due         date,
  high        boolean not null default false,
  assigned_to bigint references users(id),
  contact_id  bigint references contacts(id),
  company_id  bigint references companies(id),
  done_at     timestamptz,
  created_by  bigint references users(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index todos_open on todos (due) where done_at is null and deleted_at is null;

-- Collins Creative's services, for "interested in" and a company's possible needs (Settings → Services).
insert into settings (key, value) values ('services', 'Website
Custom software
Web app
Mobile app
AI & automation
Branding
Ecommerce
SEO & Google Business
Customer portal
Ongoing support');
