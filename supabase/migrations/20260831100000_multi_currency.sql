-- Feature 9 — multi-currency.
--
-- Expenses already carry `currency` and `fx_rate_to_group_currency` (the rate
-- to convert the expense into the group's default currency, captured at entry
-- time). This migration adds the same to settlements and a cache table for
-- fetched exchange rates. Balances are converted to the group currency for a
-- single combined view; the per-line amounts stay in their original currency.

alter table public.settlements
  add column fx_rate_to_group_currency numeric not null default 1
    check (fx_rate_to_group_currency > 0);

-- creator or owner may update a settlement (e.g. to correct its fx rate)
create policy "creator or owner can update settlements"
  on public.settlements for update
  to authenticated
  using (
    created_by = (select auth.uid()) or public.is_group_owner(group_id)
  )
  with check (
    created_by = (select auth.uid()) or public.is_group_owner(group_id)
  );

-- ---------------------------------------------------------------------------
-- Exchange-rate cache. Rows are public reference data (ECB rates via the
-- Frankfurter API); any signed-in user may read or fill the cache.
-- ---------------------------------------------------------------------------
create table public.exchange_rates (
  base_currency text not null check (char_length(base_currency) = 3),
  quote_currency text not null check (char_length(quote_currency) = 3),
  as_of_date date not null,
  rate numeric not null check (rate > 0),
  source text not null default 'frankfurter',
  fetched_at timestamptz not null default now(),
  primary key (base_currency, quote_currency, as_of_date)
);

alter table public.exchange_rates enable row level security;

create policy "exchange rates are readable by authenticated users"
  on public.exchange_rates for select
  to authenticated
  using (true);

create policy "authenticated users can fill the exchange-rate cache"
  on public.exchange_rates for insert
  to authenticated
  with check (true);

create policy "authenticated users can refresh cached exchange rates"
  on public.exchange_rates for update
  to authenticated
  using (true)
  with check (true);
