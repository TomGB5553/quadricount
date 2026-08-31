-- Improve the group-invite acceptance flow.
--
-- Before: a group-level link always added the joiner as a brand-new member,
-- even when the group already had a placeholder that was really them.
-- Now the accept page can offer "I'm one of these existing members" (claim a
-- placeholder slot) or "add me as a new member" with a per-group name.
--
-- Members are identified everywhere by group_members.id (a uuid); display_name
-- is display only, so a person can be named differently per group with no
-- effect on balances or transfers.

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

create or replace function public.accept_invitation(
  p_token text,
  p_member_id uuid default null,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv_member uuid;
  v_group_id uuid;
  v_accepted timestamptz;
  v_inv_member_user uuid;
  v_name text;
  v_claim uuid;
begin
  select i.member_id, i.group_id, i.accepted_at, gm.user_id
  into v_inv_member, v_group_id, v_accepted, v_inv_member_user
  from public.group_invitations i
  left join public.group_members gm on gm.id = i.member_id
  where i.token = p_token;

  if v_group_id is null then
    raise exception 'this invite link is not valid';
  end if;
  if exists (
    select 1 from public.group_members
    where group_id = v_group_id and user_id = v_uid
  ) then
    raise exception 'you are already a member of this group';
  end if;

  -- placeholder-specific link: claim exactly that slot
  if v_inv_member is not null then
    if v_accepted is not null then
      raise exception 'this invite has already been used';
    end if;
    if v_inv_member_user is not null then
      raise exception 'this spot has already been taken';
    end if;
    update public.group_members set user_id = v_uid where id = v_inv_member;
    update public.group_invitations
    set accepted_at = now(), accepted_by = v_uid
    where token = p_token;
    return v_group_id;
  end if;

  -- group-level link
  if p_member_id is not null then
    select id into v_claim
    from public.group_members
    where id = p_member_id
      and group_id = v_group_id
      and user_id is null
      and status = 'active'
      and role <> 'owner';
    if v_claim is null then
      raise exception 'that spot is not available';
    end if;
    update public.group_members set user_id = v_uid where id = v_claim;
    return v_group_id;
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Member') into v_name
  from public.profiles where id = v_uid;
  v_name := coalesce(nullif(trim(p_display_name), ''), v_name, 'Member');

  insert into public.group_members (
    group_id, user_id, display_name, role, status
  )
  values (v_group_id, v_uid, v_name, 'member', 'active');

  return v_group_id;
end;
$$;
