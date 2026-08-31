-- Restrict currencies to the set we can actually convert (the ECB / Frankfurter
-- list). Before this, currency was free text: any 3-letter string (e.g. "TAM")
-- was accepted and getFxRate() silently fell back to a 1:1 rate. The UI now
-- uses a dropdown, but this enforces it at the database level too, so direct
-- API calls can't slip an unknown currency through either.

create table public.currencies (
  code text primary key check (char_length(code) = 3)
);

insert into public.currencies (code) values
  ('EUR'), ('USD'), ('GBP'), ('CHF'), ('JPY'), ('AUD'), ('CAD'), ('CNY'),
  ('CZK'), ('DKK'), ('HKD'), ('HUF'), ('ILS'), ('INR'), ('ISK'), ('KRW'),
  ('MXN'), ('NOK'), ('NZD'), ('PLN'), ('RON'), ('SEK'), ('SGD'), ('THB'),
  ('TRY'), ('ZAR'), ('BGN'), ('BRL'), ('IDR'), ('MYR'), ('PHP');

alter table public.currencies enable row level security;

create policy "currencies are readable by authenticated users"
  on public.currencies for select
  to authenticated
  using (true);

-- Repair any pre-existing unsupported currency (the fictional "TAM" test group)
-- to EUR so the foreign keys below can be added. Affected groups should be
-- switched to their intended currency once group editing exists.
update public.groups set default_currency = 'EUR'
  where default_currency not in (select code from public.currencies);
update public.expenses set currency = 'EUR'
  where currency not in (select code from public.currencies);
update public.settlements set currency = 'EUR'
  where currency not in (select code from public.currencies);
update public.group_balance_transfers set currency = 'EUR'
  where currency not in (select code from public.currencies);
delete from public.exchange_rates
  where base_currency not in (select code from public.currencies)
     or quote_currency not in (select code from public.currencies);

alter table public.groups
  add constraint groups_default_currency_fkey
  foreign key (default_currency) references public.currencies (code);

alter table public.expenses
  add constraint expenses_currency_fkey
  foreign key (currency) references public.currencies (code);

alter table public.settlements
  add constraint settlements_currency_fkey
  foreign key (currency) references public.currencies (code);

alter table public.group_balance_transfers
  add constraint group_balance_transfers_currency_fkey
  foreign key (currency) references public.currencies (code);

alter table public.exchange_rates
  add constraint exchange_rates_base_currency_fkey
  foreign key (base_currency) references public.currencies (code),
  add constraint exchange_rates_quote_currency_fkey
  foreign key (quote_currency) references public.currencies (code);
