-- Feature 8 — remove (deactivate) a member.
-- Removal never deletes rows: the member's expense/payment history stays
-- intact so past balances remain correct. It only flips a status flag.

create function public.set_member_status(
  p_member_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_role text;
  v_actor_member uuid;
begin
  select group_id, role into v_group_id, v_role
  from public.group_members
  where id = p_member_id;

  if v_group_id is null then
    raise exception 'member not found';
  end if;
  if not public.is_group_owner(v_group_id) then
    raise exception 'only the group owner can change members';
  end if;
  if p_status not in ('active', 'inactive') then
    raise exception 'invalid status';
  end if;
  if v_role = 'owner' then
    raise exception 'the group owner cannot be removed';
  end if;

  select id into v_actor_member
  from public.group_members
  where group_id = v_group_id and user_id = (select auth.uid());

  update public.group_members
  set
    status = p_status,
    removed_at = case when p_status = 'inactive' then now() else null end,
    removed_by = case when p_status = 'inactive' then v_actor_member else null end
  where id = p_member_id;
end;
$$;
