-- Fix merge_members: a merged person is ONE participant, not two.
--
-- The first version added the two members' shares together. When both were
-- in the same equal split (8 people listed for 7 real ones), the survivor
-- kept 2/8 and everyone else stayed at 1/8 — the duplicate was baked in.
-- Now split entries are deduplicated and every affected expense's shares
-- are recomputed from its split settings:
--   equal      -> one entry (the duplicate disappears, others' shares grow)
--   shares     -> one entry, the larger weight
--   percentage -> percents added (keeps the 100% total)
--   exact      -> amounts added (keeps the stated total)
-- Payers are still added together: that money was really paid.

-- Rebuild expense_allocations from the stored components + entries.
-- Same maths as _populate_expense_splits.
create or replace function public._recompute_allocations(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total bigint;
  v_fixed_sum bigint;
  v_comp record;
  v_coverage bigint;
  v_ids uuid[];
  v_weights numeric[];
begin
  select total_amount into v_total from public.expenses where id = p_expense_id;
  select coalesce(sum(amount), 0) into v_fixed_sum
    from public.expense_split_components
    where expense_id = p_expense_id and basis = 'fixed_amount';

  create temporary table if not exists _realloc (
    member_id uuid primary key,
    amount bigint not null
  ) on commit drop;
  delete from _realloc;

  for v_comp in
    select * from public.expense_split_components
    where expense_id = p_expense_id order by seq
  loop
    v_coverage := case when v_comp.basis = 'fixed_amount'
      then v_comp.amount else v_total - v_fixed_sum end;

    if v_comp.method = 'exact' then
      insert into _realloc (member_id, amount)
      select member_id, exact_amount from public.expense_split_entries
      where component_id = v_comp.id
      on conflict (member_id) do update set amount = _realloc.amount + excluded.amount;
    else
      select
        array_agg(member_id order by id),
        array_agg(case v_comp.method
          when 'equal' then 1::numeric
          when 'shares' then weight
          when 'percentage' then percent end order by id)
      into v_ids, v_weights
      from public.expense_split_entries where component_id = v_comp.id;

      insert into _realloc (member_id, amount)
      select s.member_id, s.amount
      from public.proportional_split(v_coverage, v_ids, v_weights) s
      on conflict (member_id) do update set amount = _realloc.amount + excluded.amount;
    end if;
  end loop;

  if (select coalesce(sum(amount), 0) from _realloc) <> v_total then
    raise exception 'internal: recomputed shares do not sum to the total';
  end if;

  delete from public.expense_allocations where expense_id = p_expense_id;
  insert into public.expense_allocations (expense_id, member_id, amount)
  select p_expense_id, member_id, amount from _realloc;
end;
$$;

create or replace function public.merge_members(
  p_group_id uuid,
  p_keep uuid,
  p_remove uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.group_members;
  v_remove public.group_members;
  v_expense uuid;
  v_affected uuid[];
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'only the group owner can merge members';
  end if;
  if p_keep = p_remove then
    raise exception 'pick two different members';
  end if;

  select * into v_keep from public.group_members
    where id = p_keep and group_id = p_group_id for update;
  select * into v_remove from public.group_members
    where id = p_remove and group_id = p_group_id for update;
  if v_keep.id is null or v_remove.id is null then
    raise exception 'member not found in this group';
  end if;
  if v_remove.role = 'owner' then
    raise exception 'the owner cannot be the member that disappears';
  end if;

  -- expenses whose shares must be recomputed
  select array_agg(distinct c.expense_id) into v_affected
  from public.expense_split_entries e
  join public.expense_split_components c on c.id = e.component_id
  where e.member_id = p_remove;

  -- payers: add amounts (real money paid)
  update public.expense_payers k set amount = k.amount + r.amount
    from public.expense_payers r
    where r.expense_id = k.expense_id and r.member_id = p_remove and k.member_id = p_keep;
  delete from public.expense_payers r where r.member_id = p_remove
    and exists (select 1 from public.expense_payers k where k.expense_id = r.expense_id and k.member_id = p_keep);
  update public.expense_payers set member_id = p_keep where member_id = p_remove;

  -- split entries where both appear: one person, see rules above
  update public.expense_split_entries k set
      weight = case c.method when 'shares' then greatest(k.weight, r.weight) else k.weight end,
      percent = case c.method when 'percentage' then k.percent + r.percent else k.percent end,
      exact_amount = case c.method when 'exact' then k.exact_amount + r.exact_amount else k.exact_amount end
    from public.expense_split_entries r, public.expense_split_components c
    where r.component_id = k.component_id and c.id = k.component_id
      and r.member_id = p_remove and k.member_id = p_keep;
  delete from public.expense_split_entries r where r.member_id = p_remove
    and exists (select 1 from public.expense_split_entries k where k.component_id = r.component_id and k.member_id = p_keep);
  update public.expense_split_entries set member_id = p_keep where member_id = p_remove;

  -- allocations: move the rest over, then recompute affected expenses
  delete from public.expense_allocations r where r.member_id = p_remove
    and exists (select 1 from public.expense_allocations k where k.expense_id = r.expense_id and k.member_id = p_keep);
  update public.expense_allocations set member_id = p_keep where member_id = p_remove;
  foreach v_expense in array coalesce(v_affected, '{}') loop
    perform public._recompute_allocations(v_expense);
  end loop;

  -- payments between the two become meaningless; others are repointed
  delete from public.settlements
    where group_id = p_group_id
      and ((from_member = p_keep and to_member = p_remove)
        or (from_member = p_remove and to_member = p_keep))
      and source = 'manual_payment';
  update public.settlements set from_member = p_keep where from_member = p_remove;
  update public.settlements set to_member = p_keep where to_member = p_remove;

  update public.group_members set removed_by = p_keep where removed_by = p_remove;
  delete from public.group_invitations where member_id = p_remove;
  delete from public.group_members where id = p_remove;

  if v_keep.user_id is null and v_remove.user_id is not null then
    update public.group_members set user_id = v_remove.user_id where id = p_keep;
  end if;
end;
$$;

-- One-off repair: "Grosse course" in Chalet Anniv Louna kept Tom's double
-- share from the manual merge on 2026-11-11. Its split entries are already
-- deduplicated (7 people), so recomputing gives everyone 1/7.
select public._recompute_allocations(c.expense_id)
from public.expense_split_components c
join public.expenses e on e.id = c.expense_id
where e.group_id = '741334b8-5131-4d45-ad7c-840e374f6006'
  and e.description = 'Grosse course'
group by c.expense_id;

-- ---------------------------------------------------------------------------
-- People from your other groups ("contacts"), for the add-member picker.
-- ---------------------------------------------------------------------------

-- Everyone who shares an active group with the caller, minus people already
-- in p_group_id. Sorted by how many groups you share.
create or replace function public.my_contacts(p_group_id uuid)
returns table (user_id uuid, display_name text, username text, shared_groups int)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.display_name, p.username, count(distinct mine.group_id)::int
  from public.group_members mine
  join public.groups g on g.id = mine.group_id
  join public.group_members other
    on other.group_id = mine.group_id
   and other.user_id is not null
   and other.user_id <> auth.uid()
   and other.status = 'active'
  join public.profiles p on p.id = other.user_id
  where mine.user_id = auth.uid()
    and mine.status = 'active'
    and public.is_group_member(p_group_id)
    and not exists (
      select 1 from public.group_members x
      where x.group_id = p_group_id and x.user_id = other.user_id
    )
  group by p.id, p.display_name, p.username
  order by count(distinct mine.group_id) desc, p.display_name;
$$;

-- Add a contact to a group, already linked to their account. With
-- p_member_id, link them to that existing unclaimed spot instead (keeps its
-- expenses) — e.g. a "Louna" placeholder becomes the real Louna.
create or replace function public.add_contact_to_group(
  p_group_id uuid,
  p_user_id uuid,
  p_member_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'you must be a member of this group';
  end if;
  if not exists (
    select 1 from public.group_members mine
    join public.group_members other on other.group_id = mine.group_id
    where mine.user_id = auth.uid() and mine.status = 'active'
      and other.user_id = p_user_id and other.status = 'active'
  ) then
    raise exception 'you can only add people you share a group with';
  end if;
  if exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  ) then
    raise exception 'this person is already in the group';
  end if;

  if p_member_id is not null then
    update public.group_members set user_id = p_user_id
      where id = p_member_id and group_id = p_group_id
        and user_id is null and status = 'active'
      returning id into v_member_id;
    if v_member_id is null then
      raise exception 'that spot is no longer available';
    end if;
  else
    insert into public.group_members (group_id, user_id, display_name, role, status)
    select p_group_id, p.id, p.display_name, 'member', 'active'
    from public.profiles p where p.id = p_user_id
    returning id into v_member_id;
  end if;

  return v_member_id;
end;
$$;

grant execute on function public.my_contacts(uuid) to authenticated;
grant execute on function public.add_contact_to_group(uuid, uuid, uuid) to authenticated;
