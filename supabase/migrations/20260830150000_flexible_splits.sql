-- Flexible / mixed expense splitting.
--
-- An expense total is divided into one or more "components". Each component
-- covers part of the total (a fixed amount, or "the remainder") and splits
-- that part among its participants by one method:
--   equal      - same share each
--   exact      - a stated amount each (must sum to the component's amount)
--   percentage - a percent each (must sum to 100)
--   shares     - a weight each (e.g. 2 vs 1)
--
-- A "mixed" split is just more than one component, e.g. component A splits
-- €50 equally among everyone and component B splits the remaining €30 by
-- exact amounts. The per-member results are summed across components into
-- expense_allocations, which everything else already reads.

create table public.expense_split_components (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  method text not null check (method in ('equal', 'exact', 'percentage', 'shares')),
  basis text not null default 'remainder'
    check (basis in ('remainder', 'fixed_amount')),
  -- set only when basis = 'fixed_amount': how much of the total this covers
  amount bigint
    check (
      (basis = 'fixed_amount' and amount is not null and amount > 0)
      or (basis = 'remainder' and amount is null)
    ),
  seq int not null default 0,
  created_at timestamptz not null default now()
);

create index expense_split_components_expense_id_idx
  on public.expense_split_components (expense_id);

-- at most one "remainder" component per expense (otherwise coverage is ambiguous)
create unique index expense_split_components_one_remainder
  on public.expense_split_components (expense_id)
  where basis = 'remainder';

create table public.expense_split_entries (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null
    references public.expense_split_components (id) on delete cascade,
  member_id uuid not null references public.group_members (id),
  -- method-specific parameter; the others stay null
  weight numeric check (weight is null or weight > 0),
  percent numeric check (percent is null or (percent >= 0 and percent <= 100)),
  exact_amount bigint check (exact_amount is null or exact_amount >= 0),
  unique (component_id, member_id)
);

create index expense_split_entries_component_id_idx
  on public.expense_split_entries (component_id);
create index expense_split_entries_member_id_idx
  on public.expense_split_entries (member_id);

-- ---------------------------------------------------------------------------
-- Helper: split an amount among members proportionally to weights, using
-- largest-remainder rounding so the parts sum back to exactly p_amount.
-- Deterministic: leftover minor units go to the largest fractional parts,
-- ties broken by member_id.
-- ---------------------------------------------------------------------------
create function public.proportional_split(
  p_amount bigint,
  p_member_ids uuid[],
  p_weights numeric[]
)
returns table (member_id uuid, amount bigint)
language sql
immutable
as $$
  with input as (
    select m as member_id, w as weight
    from unnest(p_member_ids, p_weights) as t(m, w)
  ),
  tw as (select sum(weight) as total_weight from input),
  raw as (
    select
      i.member_id,
      floor(p_amount * i.weight / tw.total_weight)::bigint as floor_amt,
      (p_amount * i.weight / tw.total_weight)
        - floor(p_amount * i.weight / tw.total_weight) as frac
    from input i, tw
  ),
  agg as (select coalesce(sum(floor_amt), 0) as floor_sum from raw),
  ranked as (
    select
      r.member_id,
      r.floor_amt,
      row_number() over (order by r.frac desc, r.member_id asc) as rn
    from raw r
  )
  select
    rk.member_id,
    (rk.floor_amt
      + case when rk.rn <= (p_amount - agg.floor_sum) then 1 else 0 end)::bigint
  from ranked rk, agg;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create an expense with an arbitrary set of split components.
--   p_payers:     [{"member_id": uuid, "amount": bigint}]
--   p_components: [{
--                    "method": "equal|exact|percentage|shares",
--                    "basis":  "remainder|fixed_amount",
--                    "amount": bigint,           -- only for fixed_amount
--                    "entries": [{"member_id": uuid,
--                                 "weight": numeric,        -- shares
--                                 "percent": numeric,       -- percentage
--                                 "exact_amount": bigint}]  -- exact
--                  }]
-- An equal split of the whole expense is a single component:
--   {"method":"equal","basis":"remainder","entries":[{member_id}...]}
-- ---------------------------------------------------------------------------
create function public.create_expense_with_splits(
  p_group_id uuid,
  p_description text,
  p_total_amount bigint,
  p_currency text,
  p_spent_at date,
  p_payers jsonb,
  p_components jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_expense_id uuid;
  v_currency text;
  v_payer_sum bigint;
  v_fixed_sum bigint := 0;
  v_has_remainder boolean := false;
  v_comp jsonb;
  v_comp_id uuid;
  v_method text;
  v_basis text;
  v_coverage bigint;
  v_member_ids uuid[];
  v_weights numeric[];
  v_exact_sum bigint;
  v_seq int := 0;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'total amount must be positive';
  end if;
  if p_components is null or jsonb_array_length(p_components) = 0 then
    raise exception 'at least one split component is required';
  end if;

  -- payers must sum to the total and belong to the group
  select coalesce(sum((e ->> 'amount')::bigint), 0) into v_payer_sum
  from jsonb_array_elements(p_payers) e;
  if v_payer_sum <> p_total_amount then
    raise exception 'payer amounts (%) must sum to the total (%)',
      v_payer_sum, p_total_amount;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payers) e
    where (e ->> 'member_id')::uuid not in (
      select id from public.group_members where group_id = p_group_id
    )
  ) then
    raise exception 'a payer is not a member of this group';
  end if;

  -- first pass: total up the fixed components, ensure at most one remainder
  for v_comp in select * from jsonb_array_elements(p_components)
  loop
    v_basis := coalesce(v_comp ->> 'basis', 'remainder');
    if v_basis = 'fixed_amount' then
      v_fixed_sum := v_fixed_sum + (v_comp ->> 'amount')::bigint;
    elsif v_basis = 'remainder' then
      if v_has_remainder then
        raise exception 'only one remainder component is allowed';
      end if;
      v_has_remainder := true;
    else
      raise exception 'invalid component basis: %', v_basis;
    end if;
  end loop;

  if v_fixed_sum > p_total_amount then
    raise exception 'fixed split amounts (%) exceed the total (%)',
      v_fixed_sum, p_total_amount;
  end if;
  if not v_has_remainder and v_fixed_sum <> p_total_amount then
    raise exception
      'split amounts (%) must sum to the total (%) when there is no remainder',
      v_fixed_sum, p_total_amount;
  end if;

  select coalesce(nullif(trim(p_currency), ''), g.default_currency)
    into v_currency
  from public.groups g where g.id = p_group_id;

  insert into public.expenses (
    group_id, description, total_amount, currency, spent_at, created_by
  )
  values (
    p_group_id, trim(p_description), p_total_amount, v_currency,
    coalesce(p_spent_at, current_date), v_uid
  )
  returning id into v_expense_id;

  insert into public.expense_payers (expense_id, member_id, amount)
  select v_expense_id, (e ->> 'member_id')::uuid, (e ->> 'amount')::bigint
  from jsonb_array_elements(p_payers) e;

  -- accumulate per-member amounts across every component
  create temporary table _alloc (
    member_id uuid primary key,
    amount bigint not null
  ) on commit drop;

  -- second pass: build components + entries, compute amounts
  for v_comp in select * from jsonb_array_elements(p_components)
  loop
    v_method := v_comp ->> 'method';
    v_basis := coalesce(v_comp ->> 'basis', 'remainder');
    v_seq := v_seq + 1;

    if v_method not in ('equal', 'exact', 'percentage', 'shares') then
      raise exception 'invalid split method: %', v_method;
    end if;
    if jsonb_array_length(coalesce(v_comp -> 'entries', '[]'::jsonb)) = 0 then
      raise exception 'a split component has no participants';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_comp -> 'entries') en
      where (en ->> 'member_id')::uuid not in (
        select id from public.group_members where group_id = p_group_id
      )
    ) then
      raise exception 'a split participant is not a member of this group';
    end if;

    if v_basis = 'fixed_amount' then
      v_coverage := (v_comp ->> 'amount')::bigint;
    else
      v_coverage := p_total_amount - v_fixed_sum;
    end if;
    if v_coverage < 0 then
      raise exception 'a split component has negative coverage';
    end if;

    insert into public.expense_split_components (
      expense_id, method, basis, amount, seq
    )
    values (
      v_expense_id, v_method, v_basis,
      case when v_basis = 'fixed_amount' then v_coverage else null end,
      v_seq
    )
    returning id into v_comp_id;

    insert into public.expense_split_entries (
      component_id, member_id, weight, percent, exact_amount
    )
    select
      v_comp_id,
      (en ->> 'member_id')::uuid,
      nullif(en ->> 'weight', '')::numeric,
      nullif(en ->> 'percent', '')::numeric,
      nullif(en ->> 'exact_amount', '')::bigint
    from jsonb_array_elements(v_comp -> 'entries') en;

    if v_method = 'exact' then
      select coalesce(sum((en ->> 'exact_amount')::bigint), 0)
        into v_exact_sum
      from jsonb_array_elements(v_comp -> 'entries') en;
      if v_exact_sum <> v_coverage then
        raise exception
          'exact amounts (%) must sum to this component''s amount (%)',
          v_exact_sum, v_coverage;
      end if;

      insert into _alloc (member_id, amount)
      select (en ->> 'member_id')::uuid, (en ->> 'exact_amount')::bigint
      from jsonb_array_elements(v_comp -> 'entries') en
      on conflict (member_id)
        do update set amount = _alloc.amount + excluded.amount;
    else
      select
        array_agg((en ->> 'member_id')::uuid order by ord),
        array_agg(
          case v_method
            when 'equal' then 1::numeric
            when 'shares' then (en ->> 'weight')::numeric
            when 'percentage' then (en ->> 'percent')::numeric
          end
          order by ord
        )
      into v_member_ids, v_weights
      from jsonb_array_elements(v_comp -> 'entries')
        with ordinality as t(en, ord);

      if (select bool_or(w is null or w <= 0) from unnest(v_weights) w) then
        raise exception 'split weights / percentages must be positive';
      end if;
      if v_method = 'percentage'
        and (select abs(sum(w) - 100) from unnest(v_weights) w) > 0.01
      then
        raise exception 'percentages must sum to 100';
      end if;

      insert into _alloc (member_id, amount)
      select s.member_id, s.amount
      from public.proportional_split(v_coverage, v_member_ids, v_weights) s
      on conflict (member_id)
        do update set amount = _alloc.amount + excluded.amount;
    end if;
  end loop;

  insert into public.expense_allocations (expense_id, member_id, amount)
  select v_expense_id, member_id, amount from _alloc;

  if (select coalesce(sum(amount), 0) from _alloc) <> p_total_amount then
    raise exception 'internal: allocations (%) do not sum to the total (%)',
      (select sum(amount) from _alloc), p_total_amount;
  end if;

  return v_expense_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: split rows are readable by members of the expense's
-- group. Writes happen only through create_expense_with_splits().
-- ---------------------------------------------------------------------------
alter table public.expense_split_components enable row level security;
alter table public.expense_split_entries enable row level security;

create policy "group members can view split components"
  on public.expense_split_components for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_group_member(e.group_id)
    )
  );

create policy "group members can view split entries"
  on public.expense_split_entries for select
  to authenticated
  using (
    exists (
      select 1
      from public.expense_split_components c
      join public.expenses e on e.id = c.expense_id
      where c.id = component_id and public.is_group_member(e.group_id)
    )
  );
