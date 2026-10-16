-- Rolodex · Phase 4, outreach (2026-10-15; Docs section 8), send-only (Brendan: "like Light Ops' Resend"): Rolodex
-- sends from the person's own address and records what it sent; replies arrive in their normal inbox, so "replied" is
-- marked by hand.

-- Reusable emails. {{first_name}}, {{name}}, {{company}} and {{my_name}} are filled in per person when used.
create table email_templates (
  id          bigint generated always as identity primary key,
  name        text not null,
  subject     text not null default '',
  body        text not null default '',
  created_by  bigint references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- A campaign: one email to a list (a tag, a lead stage, picked people), and who answered.
create table campaigns (
  id          bigint generated always as identity primary key,
  name        text not null,
  subject     text not null default '',
  body        text not null default '',
  created_by  bigint references users(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create table campaign_people (
  campaign_id bigint not null references campaigns(id),
  contact_id  bigint references contacts(id),
  company_id  bigint references companies(id),             -- a company's general email (info@…) when there's no person
  status      text not null default 'to_send' check (status in ('to_send', 'sent', 'replied', 'follow_up', 'not_interested', 'skipped')),
  status_at   timestamptz not null default now(),
  check ((contact_id is null) <> (company_id is null))
);
create unique index campaign_people_contact on campaign_people (campaign_id, contact_id) where contact_id is not null;
create unique index campaign_people_company on campaign_people (campaign_id, company_id) where company_id is not null;

-- Every email Rolodex sent (or, on a test copy, would have sent).
create table emails (
  id           bigint generated always as identity primary key,
  contact_id   bigint references contacts(id),
  company_id   bigint references companies(id),
  campaign_id  bigint references campaigns(id),
  to_email     text not null,
  from_email   text not null,
  subject      text not null,
  body         text not null,
  status       text not null check (status in ('sent', 'failed', 'test')),
  provider_id  text not null default '',
  error        text not null default '',
  sent_by      bigint references users(id),
  sent_at      timestamptz not null default now()
);
create index emails_contact on emails (contact_id, sent_at desc);
create index emails_company on emails (company_id, sent_at desc);

-- Each person's email signature (added under every email they send).
alter table users add column signature text not null default '';
