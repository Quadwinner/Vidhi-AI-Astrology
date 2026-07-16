-- Ensure timestamp columns exist on system_prompts and auto-update updated_at
alter table if exists public.system_prompts add column if not exists created_at timestamptz not null default now();
alter table if exists public.system_prompts add column if not exists updated_at timestamptz not null default now();

-- Helper trigger to update updated_at on row change
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_system_prompts_updated_at') then
    create trigger trg_system_prompts_updated_at
    before update on public.system_prompts
    for each row execute function public.set_updated_at();
  end if;
end $$;



