-- Provenance for local company artwork and the 160px export required by the
-- enrichment workflow. External URLs are evidence only; the UI uses local files.
create table if not exists company_logo_assets (
  company_id          bigint primary key references companies(id) on delete cascade,
  src64               text not null,
  src104              text not null,
  src160              text not null,
  source_url          text not null default '',
  verification_status text not null check (verification_status in ('verified', 'fallback', 'manual_review', 'rejected')),
  checked_at          timestamptz not null default now(),
  verified_by         bigint references users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table contact_photo_assets
  add column if not exists src160 text;
alter table contact_photo_assets
  add column if not exists bytes160 int check (bytes160 is null or bytes160 >= 0);
alter table contact_photo_assets
  add column if not exists verification_status text not null default 'verified'
    check (verification_status in ('verified', 'manual_review', 'rejected'));
alter table contact_photo_assets
  add column if not exists checked_at timestamptz not null default now();

create index if not exists company_logo_assets_checked on company_logo_assets (checked_at desc);
