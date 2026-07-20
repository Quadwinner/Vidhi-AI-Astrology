alter table public.users
  add column if not exists tarot_free_draws_used integer not null default 0;

insert into public.service_prices (service_key, currency_code, price_amount, variant_name)
select v.service_key, v.currency_code, v.price_amount, v.variant_name
from (values
  ('tarot_draw', 'INR', 300, 'control'),
  ('tarot_draw', 'USD', 5,   'control'),
  ('tarot_draw', 'AED', 20,  'control')
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
select 'tarot_free_draws_premium', '50', 'Number of free tarot draws for premium (subscribed) members before wallet charges apply', now()
where not exists (select 1 from public.settings s where s.key = 'tarot_free_draws_premium');
