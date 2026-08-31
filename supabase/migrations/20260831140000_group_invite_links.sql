-- Group-level invite links: a reusable link that lets anyone signed in join
-- the group as a new member (as opposed to claiming a specific placeholder).
-- Reuses the group_invitations table with a null member_id.

alter table public.group_invitations
  alter column member_id drop not null;

-- at most one active group-level link per group
create unique index group_invitations_one_group_link
  on public.group_invitations (group_id)
  where member_id is null;

-- ---------------------------------------------------------------------------
-- Owner: create (or fetch the existing) group-level invite link.
-- ---------------------------------------------------------------------------
create function public.create_group_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'only the group owner can invite people';
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

-- ---------------------------------------------------------------------------
-- Replace invitation_preview: handle the null-member (group link) case.
-- ---------------------------------------------------------------------------
create or replace function public.invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'group_name', g.name,
    'group_invite', (i.member_id is null),
    'member_name', gm.display_name,
    'accepted', (i.accepted_at is not null),
    'claimed', (gm.user_id is not null)
  )
  into v
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  left join public.group_members gm on gm.id = i.member_id
  where i.token = p_token;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Replace accept_invitation: null member_id -> add the caller as a new member.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member_id uuid;
  v_group_id uuid;
  v_accepted timestamptz;
  v_user_id uuid;
  v_name text;
begin
  select i.member_id, i.group_id, i.accepted_at, gm.user_id
  into v_member_id, v_group_id, v_accepted, v_user_id
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

  if v_member_id is null then
    -- group-level link: join as a brand new member
    select coalesce(nullif(trim(display_name), ''), 'Member')
      into v_name
    from public.profiles where id = v_uid;

    insert into public.group_members (
      group_id, user_id, display_name, role, status
    )
    values (v_group_id, v_uid, coalesce(v_name, 'Member'), 'member', 'active');
  else
    -- placeholder link: claim that specific spot
    if v_accepted is not null then
      raise exception 'this invite has already been used';
    end if;
    if v_user_id is not null then
      raise exception 'this spot has already been taken';
    end if;

    update public.group_members set user_id = v_uid where id = v_member_id;
    update public.group_invitations
    set accepted_at = now(), accepted_by = v_uid
    where token = p_token;
  end if;

  return v_group_id;
end;
$$;
