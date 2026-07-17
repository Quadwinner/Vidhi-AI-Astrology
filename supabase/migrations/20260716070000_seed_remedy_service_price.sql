-- Dedicated price for the Remedies feature (service_key = 'remedy').
-- Seeds the 'control' variant for each supported currency if not already present.
-- Admin can edit these from the Price Manager (which now writes to service_prices).
insert into public.service_prices (service_key, currency_code, price_amount, variant_name)
select v.service_key, v.currency_code, v.price_amount, v.variant_name
from (values
  ('remedy', 'INR', 1500, 'control'),
  ('remedy', 'USD', 100,  'control'),
  ('remedy', 'AED', 100,  'control')
) as v(service_key, currency_code, price_amount, variant_name)
where not exists (
  select 1 from public.service_prices sp
  where sp.service_key = v.service_key
    and sp.currency_code = v.currency_code
    and sp.variant_name = v.variant_name
);
