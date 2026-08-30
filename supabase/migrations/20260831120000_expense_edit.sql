-- Editing an expense. The split-building logic is factored into a helper so
-- create and update share it; update rebuilds all payer/split/allocation rows
-- for the same expense id.

-- ---------------------------------------------------------------------------
-- Helper: validate + write the payers, split components/entries and computed
-- allocations for an already-existing expense row.
-- ---------------------------------------------------------------------------
create function public._populate_expense_splits(
  p_expense_id uuid,
  p_group_id uuid,
  p_total_amount bigint,
  p_payers jsonb,
  p_components jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
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
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'total amount must be positive';
  end if;
  if p_components is null or jsonb_array_length(p_components) = 0 then
    raise exception 'at least one split component is required';
  end if;

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

  insert into public.expense_payers (expense_id, member_id, amount)
  select p_expense_id, (e ->> 'member_id')::uuid, (e ->> 'amount')::bigint
  from jsonb_array_elements(p_payers) e;

  create temporary table _alloc (
    member_id uuid primary key,
    amount bigint not null
  ) on commit drop;

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
      p_expense_id, v_method, v_basis,
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
  select p_expense_id, member_id, amount from _alloc;

  if (select coalesce(sum(amount), 0) from _alloc) <> p_total_amount then
    raise exception 'internal: allocations (%) do not sum to the total (%)',
      (select sum(amount) from _alloc), p_total_amount;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recreate create_expense_with_splits on top of the helper.
-- ---------------------------------------------------------------------------
drop function public.create_expense_with_splits(
  uuid, text, bigint, text, date, jsonb, jsonb
);

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
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member of this group';
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

  perform public._populate_expense_splits(
    v_expense_id, p_group_id, p_total_amount, p_payers, p_components
  );
  return v_expense_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Edit an existing expense: rebuild everything for the same id.
-- ---------------------------------------------------------------------------
create function public.update_expense_with_splits(
  p_expense_id uuid,
  p_description text,
  p_total_amount bigint,
  p_currency text,
  p_spent_at date,
  p_payers jsonb,
  p_components jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
  v_created_by uuid;
  v_currency text;
begin
  select group_id, created_by into v_group_id, v_created_by
  from public.expenses where id = p_expense_id;
  if v_group_id is null then
    raise exception 'expense not found';
  end if;
  if v_created_by <> v_uid and not public.is_group_owner(v_group_id) then
    raise exception
      'only the person who added this expense or the group owner can edit it';
  end if;

  delete from public.expense_payers where expense_id = p_expense_id;
  delete from public.expense_allocations where expense_id = p_expense_id;
  delete from public.expense_split_components where expense_id = p_expense_id;

  select coalesce(nullif(trim(p_currency), ''), g.default_currency)
    into v_currency
  from public.groups g where g.id = v_group_id;

  update public.expenses
  set
    description = trim(p_description),
    total_amount = p_total_amount,
    currency = v_currency,
    spent_at = coalesce(p_spent_at, current_date),
    fx_rate_to_group_currency = 1
  where id = p_expense_id;

  perform public._populate_expense_splits(
    p_expense_id, v_group_id, p_total_amount, p_payers, p_components
  );
end;
$$;
