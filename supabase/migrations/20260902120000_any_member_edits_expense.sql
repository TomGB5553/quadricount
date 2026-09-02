-- Any active member of the group can edit an expense — not just the person
-- who added it or the group owner. Mirrors the "any member can add an
-- expense" rule: the ledger is shared, and a wrong split should be fixable
-- by whoever notices it. Deleting an expense stays with its creator / owner.

create or replace function public.update_expense_with_splits(
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
  v_currency text;
begin
  select group_id into v_group_id
  from public.expenses where id = p_expense_id;
  if v_group_id is null then
    raise exception 'expense not found';
  end if;
  if not public.is_group_member(v_group_id) then
    raise exception 'only a member of this group can edit its expenses';
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
