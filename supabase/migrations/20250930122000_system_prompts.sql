-- System prompts table for configurable AI prompts
create table if not exists public.system_prompts (
  id bigserial primary key,
  name text not null unique,
  content text not null,
  model text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_prompts enable row level security;

-- Read active prompts for everyone
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='system_prompts' and policyname='Read active prompts'
  ) then
    create policy "Read active prompts" on public.system_prompts for select using (is_active = true);
  end if;
end $$;

-- Admins full access via helper
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='system_prompts' and policyname='Admins full access (prompts)'
  ) then
    create policy "Admins full access (prompts)" on public.system_prompts
      for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;


