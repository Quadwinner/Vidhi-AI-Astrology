create table if not exists public.rate_limits (
  user_id uuid not null,
  bucket_key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket_key, window_start)
);

alter table public.rate_limits enable row level security;

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

create or replace function public.increment_rate_limit(p_user uuid, p_key text, p_window_start timestamptz)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  insert into public.rate_limits (user_id, bucket_key, window_start, count)
  values (p_user, p_key, p_window_start, 1)
  on conflict (user_id, bucket_key, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

grant execute on function public.increment_rate_limit(uuid, text, timestamptz) to service_role;
