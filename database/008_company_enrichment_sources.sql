-- Verified public details added by the company-enrichment workflow. Keeping the exact source makes each
-- enrichment reviewable and avoids treating a search result as an untraceable fact.
create table if not exists company_enrichment_sources (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references companies(id) on delete cascade,
  field       text not null check (field in ('website', 'email', 'phone')),
  value       text not null,
  source_url  text not null,
  added_at    timestamptz not null default now(),
  added_by    bigint references users(id),
  unique (company_id, field, value, source_url)
);
create index if not exists company_enrichment_sources_company on company_enrichment_sources (company_id, added_at desc);
