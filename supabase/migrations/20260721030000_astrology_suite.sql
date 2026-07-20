create table if not exists public.feature_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  used_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_key)
);

alter table public.feature_usage enable row level security;

drop policy if exists "feature_usage_select_own" on public.feature_usage;
create policy "feature_usage_select_own" on public.feature_usage
  for select using (auth.uid() = user_id);

insert into public.service_prices (service_key, currency_code, price_amount, variant_name)
select v.service_key, v.currency_code, v.price_amount, v.variant_name
from (values
  ('kundli_matching', 'INR', 4900, 'control'),
  ('kundli_matching', 'USD', 100,  'control'),
  ('kundli_matching', 'AED', 400,  'control'),
  ('dosha_report', 'INR', 3900, 'control'),
  ('dosha_report', 'USD', 75,   'control'),
  ('dosha_report', 'AED', 300,  'control'),
  ('numerology', 'INR', 1900, 'control'),
  ('numerology', 'USD', 40,   'control'),
  ('numerology', 'AED', 150,  'control'),
  ('gemstone', 'INR', 1900, 'control'),
  ('gemstone', 'USD', 40,   'control'),
  ('gemstone', 'AED', 150,  'control')
) as v(service_key, currency_code, price_amount, variant_name)
where not exists (
  select 1 from public.service_prices sp
  where sp.service_key = v.service_key
    and sp.currency_code = v.currency_code
    and sp.variant_name = v.variant_name
);

select setval(
  pg_get_serial_sequence('public.settings', 'id'),
  greatest((select coalesce(max(id), 0) from public.settings), 1)
);

insert into public.settings (key, value, description, updated_at)
select k.key, k.value, k.description, now()
from (values
  ('kundli_matching_free_premium', '10', 'Free Kundli Matching reports for premium members before wallet charges apply'),
  ('dosha_report_free_premium', '10', 'Free Dosha reports for premium members before wallet charges apply'),
  ('numerology_free_premium', '10', 'Free Numerology reports for premium members before wallet charges apply'),
  ('gemstone_free_premium', '10', 'Free Gemstone/Rudraksha reports for premium members before wallet charges apply')
) as k(key, value, description)
where not exists (select 1 from public.settings s where s.key = k.key);
