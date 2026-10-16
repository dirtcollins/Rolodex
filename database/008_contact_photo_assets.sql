-- Locally stored, consented contact photos. The image files are kept under
-- app/public/contact-avatars/ and are never loaded from a social platform at render time.
-- `source_url` identifies where the permission and match were verified, not a hotlink.
create table contact_photo_assets (
  contact_id        bigint primary key references contacts(id) on delete cascade,
  src64             text not null,                 -- 64px WebP for 32px avatars
  src104            text not null,                 -- 104px WebP for 52px profile avatars
  src160            text not null default '',       -- 160px WebP for high-density detail views
  source_kind       text not null check (source_kind in ('provided', 'licensed', 'official', 'social', 'other')),
  source_url        text not null default '',
  permission_basis  text not null check (permission_basis in ('contact_consent', 'copyright_license', 'user_provided', 'owner_authorized')),
  match_basis       text not null,                  -- company, role, location, or direct confirmation
  asset_sha256      text not null default '',
  bytes64           int not null check (bytes64 >= 0),
  bytes104          int not null check (bytes104 >= 0),
  bytes160          int not null default 0 check (bytes160 >= 0),
  verified_by       bigint references users(id),
  verified_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index contact_photo_assets_verified on contact_photo_assets (verified_at desc);
