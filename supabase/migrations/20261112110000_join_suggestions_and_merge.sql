-- 1. invitation_preview also returns every active member (name, username,
--    whether an account already holds the spot) so the join flow can suggest
--    "Is that you?" matches.
-- 2. merge_members: owner folds a duplicate member into another one, keeping
--    every balance intact.

create or replace function public.invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'group_name', g.name,
    'group_invite', (i.member_id is null),
    'member_name', gm.display_name,
    'accepted', (i.accepted_at is not null),
    'claimed', (gm.user_id is not null),
    'members', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'display_name', m.display_name,
            'username', p.username,
            'claimed', (m.user_id is not null)
          )
          order by m.joined_at
        )
        from public.group_members m
        left join public.profiles p on p.id = m.user_id
        where m.group_id = i.group_id
          and m.status = 'active'
      ),
      '[]'::jsonb
    ),
    'taken_names', coalesce(
      (
        select jsonb_agg(t.display_name order by t.joined_at)
        from public.group_members t
        where t.group_id = i.group_id
          and t.user_id is not null
          and t.status = 'active'
      ),
      '[]'::jsonb
    ),
    'claimable_members', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', c.id, 'display_name', c.display_name)
          order by c.joined_at
        )
        from public.group_members c
        where c.group_id = i.group_id
          and c.user_id is null
          and c.status = 'active'
          and c.role <> 'owner'
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  left join public.group_members gm on gm.id = i.member_id
  where i.token = p_token;

  return v_result;
end;
$$;

-- Fold p_remove into p_keep. Shares, payments and split parameters are
-- added together, so every other member's balance stays exactly the same.
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

  -- payers: add amounts where both paid the same expense
  update public.expense_payers k set amount = k.amount + r.amount
    from public.expense_payers r
    where r.expense_id = k.expense_id and r.member_id = p_remove and k.member_id = p_keep;
  delete from public.expense_payers r where r.member_id = p_remove
    and exists (select 1 from public.expense_payers k where k.expense_id = r.expense_id and k.member_id = p_keep);
  update public.expense_payers set member_id = p_keep where member_id = p_remove;

  -- allocations (shares): add together
  update public.expense_allocations k set amount = k.amount + r.amount
    from public.expense_allocations r
    where r.expense_id = k.expense_id and r.member_id = p_remove and k.member_id = p_keep;
  delete from public.expense_allocations r where r.member_id = p_remove
    and exists (select 1 from public.expense_allocations k where k.expense_id = r.expense_id and k.member_id = p_keep);
  update public.expense_allocations set member_id = p_keep where member_id = p_remove;

  -- split parameters: add weights / percents / exact amounts
  update public.expense_split_entries k set
      weight = case when k.weight is null then r.weight else k.weight + coalesce(r.weight, 0) end,
      percent = case when k.percent is null then r.percent else k.percent + coalesce(r.percent, 0) end,
      exact_amount = case when k.exact_amount is null then r.exact_amount else k.exact_amount + coalesce(r.exact_amount, 0) end
    from public.expense_split_entries r
    where r.component_id = k.component_id and r.member_id = p_remove and k.member_id = p_keep;
  delete from public.expense_split_entries r where r.member_id = p_remove
    and exists (select 1 from public.expense_split_entries k where k.component_id = r.component_id and k.member_id = p_keep);
  update public.expense_split_entries set member_id = p_keep where member_id = p_remove;

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

  -- if only the removed spot was linked to an account, carry it over so
  -- that person keeps access to the group
  if v_keep.user_id is null and v_remove.user_id is not null then
    update public.group_members set user_id = v_remove.user_id where id = p_keep;
  end if;
end;
$$;

grant execute on function public.merge_members(uuid, uuid, uuid) to authenticated;
