-- Optional expense categories.
-- groups.categories: the category keys the group uses (null = feature asleep).
-- groups.group_type: optional hint (trip, home, couple, event) that picked them.
-- expenses.category: chosen category key, null = not set (the app then guesses
-- from the description with a keyword list, no AI call).

alter table public.groups
  add column group_type text,
  add column categories text[];

alter table public.expenses
  add column category text;

-- Any member can turn categories on (or change them) for their group.
create function public.set_group_categories(
  p_group_id uuid,
  p_group_type text,
  p_categories text[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;
  update public.groups
     set group_type = p_group_type,
         categories = p_categories
   where id = p_group_id;
end;
$$;

-- Any member can set an expense's category (editing is open to all members).
create function public.set_expense_category(
  p_expense_id uuid,
  p_category text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.expenses where id = p_expense_id;
  if v_group is null or not public.is_group_member(v_group) then
    raise exception 'not a member of this group';
  end if;
  update public.expenses set category = p_category where id = p_expense_id;
end;
$$;

grant execute on function public.set_group_categories(uuid, text, text[]) to authenticated;
grant execute on function public.set_expense_category(uuid, text) to authenticated;
