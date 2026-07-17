-- Daily rashifal (horoscope for all 12 rashis), cached once per day per language.
create table if not exists public.daily_rashifal (
  id          uuid primary key default gen_random_uuid(),
  rashi_date  date not null,
  lang        text not null default 'en',
  data        jsonb not null,           -- array of 12 sign prediction objects
  created_at  timestamptz not null default now(),
  unique (rashi_date, lang)
);

-- Public read (it's free marketing content). Writes happen via service role only.
alter table public.daily_rashifal enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_rashifal' and policyname = 'daily_rashifal_public_read'
  ) then
    create policy "daily_rashifal_public_read" on public.daily_rashifal for select using (true);
  end if;
end $$;
