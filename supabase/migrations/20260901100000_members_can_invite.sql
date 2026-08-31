-- Any member can grow the group: add placeholder members and generate invite
-- links. Only the owner can remove members or edit/delete the group.

create or replace function public.add_group_member(
  p_group_id uuid,
  p_display_name text
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

  insert into public.group_members (group_id, display_name, role, status)
  values (p_group_id, trim(p_display_name), 'member', 'active')
  returning id into v_member_id;

  return v_member_id;
end;
$$;

create or replace function public.create_group_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'you must be a member of this group';
  end if;

  select token into v_token
  from public.group_invitations
  where group_id = p_group_id and member_id is null;

  if v_token is null then
    insert into public.group_invitations (group_id, member_id, invited_by)
    values (p_group_id, null, (select auth.uid()))
    returning token into v_token;
  end if;

  return v_token;
end;
$$;

create or replace function public.create_invitation(p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_user_id uuid;
  v_token text;
begin
  select group_id, user_id into v_group_id, v_user_id
  from public.group_members where id = p_member_id;

  if v_group_id is null then
    raise exception 'member not found';
  end if;
  if not public.is_group_member(v_group_id) then
    raise exception 'you must be a member of this group';
  end if;
  if v_user_id is not null then
    raise exception 'this person has already joined';
  end if;

  select token into v_token
  from public.group_invitations
  where member_id = p_member_id and accepted_at is null;

  if v_token is null then
    insert into public.group_invitations (group_id, member_id, invited_by)
    values (v_group_id, p_member_id, (select auth.uid()))
    returning token into v_token;
  end if;

  return v_token;
end;
$$;
