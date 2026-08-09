-- Seed the welcome wallet credit granted to brand-new users on first signup.
-- init-user-wallet reads service_prices for service_key='welcome_bonus' and
-- credits price_amount into wallet_balance. Without a seed row this defaulted
-- to 0, so new users got nothing on signup.
--
-- Values are per-currency minor units, matching one tarot_draw in each currency
-- (tarot_draw: INR 300 / USD 5 / AED 20). GBP mirrors USD because
-- init-user-wallet assigns GBP to GB users and tarot_draw has no GBP row.
--
-- Idempotent: `where not exists` so admin edits in PriceManager are never
-- overwritten by a re-run.

insert into public.service_prices (service_key, currency_code, price_amount, variant_name)
select v.service_key, v.currency_code, v.price_amount, v.variant_name
from (values
  ('welcome_bonus', 'INR', 300, 'control'),
  ('welcome_bonus', 'USD', 5,   'control'),
  ('welcome_bonus', 'AED', 20,  'control'),
  ('welcome_bonus', 'GBP', 5,   'control')
) as v(service_key, currency_code, price_amount, variant_name)
where not exists (
  select 1 from public.service_prices sp
  where sp.service_key = v.service_key
    and sp.currency_code = v.currency_code
    and sp.variant_name = v.variant_name
);
