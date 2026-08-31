-- Edit a group's name / description / default currency (owner only).
-- The default currency can only change while the group has no expenses or
-- payments, because existing rows store an exchange rate relative to it.

create function public.update_group(
  p_group_id uuid,
  p_name text,
  p_description text,
  p_default_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_currency text;
  v_new_currency text;
  v_has_activity boolean;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'only the group owner can edit the group';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'the group needs a name';
  end if;

  select default_currency into v_current_currency
  from public.groups where id = p_group_id;

  v_new_currency := coalesce(nullif(trim(p_default_currency), ''), v_current_currency);

  if v_new_currency is distinct from v_current_currency then
    select exists (select 1 from public.expenses where group_id = p_group_id)
        or exists (select 1 from public.settlements where group_id = p_group_id)
      into v_has_activity;
    if v_has_activity then
      raise exception
        'the currency can only be changed while the group has no expenses or payments';
    end if;
  end if;

  update public.groups
  set
    name = trim(p_name),
    description = nullif(trim(coalesce(p_description, '')), ''),
    default_currency = v_new_currency
  where id = p_group_id;
end;
$$;
