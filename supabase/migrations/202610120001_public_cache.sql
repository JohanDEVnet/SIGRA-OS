begin;

-- Validated, public aggregates only. No raw RENIEC CSV rows and no personal records.
create table if not exists public.sigra_public_cache (
  cache_key text primary key check (char_length(cache_key) between 1 and 4096),
  source text not null check (source in ('PCM / RENIEC', 'IGP', 'INEI')),
  source_url text not null check (source_url like 'https://%'),
  obtained_at timestamptz not null,
  stored_at timestamptz not null,
  expires_at timestamptz not null,
  stale_until timestamptz not null,
  payload jsonb not null,
  check (stored_at >= obtained_at and stored_at < expires_at and expires_at <= stale_until),
  check (jsonb_typeof(payload) = 'object' and payload ->> 'version' = '1'),
  check (octet_length(payload::text) <= 5000000),
  check (
    (source = 'PCM / RENIEC' and (cache_key = 'population:descriptor' or cache_key ~ '^population:csv:[a-fA-F0-9-]{36}$')) or
    (source = 'IGP' and cache_key ~ '^IGP:[0-9]{4}$') or
    (source = 'INEI' and cache_key like 'localities:https://geoespacial.inei.gob.pe/%')
  )
);

create index if not exists sigra_public_cache_stale_until_idx on public.sigra_public_cache (stale_until);
alter table public.sigra_public_cache enable row level security;
revoke all on table public.sigra_public_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.sigra_public_cache to service_role;
-- Deliberately no anon/authenticated policies. The Nest server uses a server secret.
comment on table public.sigra_public_cache is 'SIGRA: validated public provider data, original provenance and bounded freshness; server-only cache.';

commit;
