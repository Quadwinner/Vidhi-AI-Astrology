-- Launch promo: the first 300 signups get a ₹100 wallet credit.
--
-- The /launch page advertises this, so the grant has to be enforced server side.
-- A ledger table is the source of truth instead of counting auth.users by date:
-- it makes the cap exact, makes the claim idempotent per user, and survives
-- backfills or test signups that would otherwise skew a date-based count.

create table if not exists public.launch_promo_claims (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  currency_code text        not null,
  amount        integer     not null,
  claimed_at    timestamptz not null default now()
);

alter table public.launch_promo_claims enable row level security;

-- No policies on purpose: only service_role (which bypasses RLS) may read or
-- write this. The public seat count is exposed via the aggregate function below.

insert into public.service_prices (service_key, currency_code, price_amount, variant_name)
select v.service_key, v.currency_code, v.price_amount, v.variant_name
from (values
  ('launch_bonus', 'INR', 10000, 'control'),
  ('launch_bonus', 'INR', 10000, 'pricing-variant-1'),
  ('launch_bonus', 'INR', 10000, 'pricing-variant-2')
) as v(service_key, currency_code, price_amount, variant_name)
where not exists (
  select 1 from public.service_prices sp
  where sp.service_key  = v.service_key
    and sp.currency_code = v.currency_code
    and sp.variant_name  = v.variant_name
);

-- Atomically claims one seat and returns the credit in minor units.
-- Returns 0 when the promo is sold out, when no launch_bonus is configured for
-- the currency, or when this user already claimed (idempotent re-signup safety).
create or replace function public.claim_launch_promo(p_user_id uuid, p_currency text, p_variant text default 'control')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  seat_limit constant integer := 300;
  v_existing integer;
  v_amount   integer;
  v_taken    integer;
begin
  if p_user_id is null or p_currency is null then
    return 0;
  end if;

  select amount into v_existing
  from public.launch_promo_claims
  where user_id = p_user_id;

  if v_existing is not null then
    return 0;
  end if;

  select price_amount into v_amount
  from public.service_prices
  where service_key   = 'launch_bonus'
    and currency_code = upper(p_currency)
    and variant_name  = coalesce(p_variant, 'control');

  if v_amount is null then
    select price_amount into v_amount
    from public.service_prices
    where service_key   = 'launch_bonus'
      and currency_code = upper(p_currency)
      and variant_name  = 'control';
  end if;

  if v_amount is null or v_amount <= 0 then
    return 0;
  end if;

  -- Serialize concurrent signups so the 300th seat cannot be handed out twice.
  perform pg_advisory_xact_lock(hashtext('launch_promo_seat'));

  select count(*) into v_taken from public.launch_promo_claims;
  if v_taken >= seat_limit then
    return 0;
  end if;

  insert into public.launch_promo_claims (user_id, currency_code, amount)
  values (p_user_id, upper(p_currency), v_amount)
  on conflict (user_id) do nothing;

  if not found then
    return 0;
  end if;

  return v_amount;
end;
$$;

comment on function public.claim_launch_promo(uuid, text, text) is
  'Claims one of the 300 launch promo seats for a user and returns the wallet credit in minor units. Returns 0 if sold out, already claimed, or unconfigured.';

revoke all on function public.claim_launch_promo(uuid, text, text) from public;
revoke all on function public.claim_launch_promo(uuid, text, text) from anon, authenticated;
grant execute on function public.claim_launch_promo(uuid, text, text) to service_role;

-- Seat counter now reads the ledger, so the progress bar matches what was
-- actually granted rather than every auth.users row created after a date.
create or replace function public.get_launch_promo_claimed()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(300, count(*))::integer from public.launch_promo_claims;
$$;

comment on function public.get_launch_promo_claimed() is
  'Returns how many of the 300 launch promo seats are taken. Aggregate only; exposes no user data.';

revoke all on function public.get_launch_promo_claimed() from public;
grant execute on function public.get_launch_promo_claimed() to anon, authenticated;
