-- Member invitations.
--
-- A group starts with placeholder members (group_members rows with a null
-- user_id). The owner generates an invite link for a placeholder; whoever
-- opens it while signed in can claim that slot, which sets the member row's
-- user_id to their account. No email is sent — the owner shares the link.

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete cascade,
  -- two uuids concatenated -> a 64-char unguessable token, no extension needed
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', ''),
  invited_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  unique (member_id)
);

alter table public.group_invitations enable row level security;

create policy "group members can view their group's invitations"
  on public.group_invitations for select
  to authenticated
  using (public.is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- Owner: create (or fetch the existing) invite token for a placeholder member.
-- ---------------------------------------------------------------------------
create function public.create_invitation(p_member_id uuid)
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
  if not public.is_group_owner(v_group_id) then
    raise exception 'only the group owner can invite people';
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

-- ---------------------------------------------------------------------------
-- Anyone signed in can look up an invite by token (to render the accept page).
-- ---------------------------------------------------------------------------
create function public.invitation_preview(p_token text)
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
    'member_name', gm.display_name,
    'accepted', (i.accepted_at is not null),
    'claimed', (gm.user_id is not null)
  )
  into v
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  join public.group_members gm on gm.id = i.member_id
  where i.token = p_token;

  return v; -- null when the token is unknown
end;
$$;

-- ---------------------------------------------------------------------------
-- Claim the placeholder slot for the signed-in user.
-- ---------------------------------------------------------------------------
create function public.accept_invitation(p_token text)
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
begin
  select i.member_id, i.group_id, i.accepted_at, gm.user_id
  into v_member_id, v_group_id, v_accepted, v_user_id
  from public.group_invitations i
  join public.group_members gm on gm.id = i.member_id
  where i.token = p_token;

  if v_member_id is null then
    raise exception 'this invite link is not valid';
  end if;
  if v_accepted is not null then
    raise exception 'this invite has already been used';
  end if;
  if v_user_id is not null then
    raise exception 'this spot has already been taken';
  end if;
  if exists (
    select 1 from public.group_members
    where group_id = v_group_id and user_id = v_uid
  ) then
    raise exception 'you are already a member of this group';
  end if;

  update public.group_members set user_id = v_uid where id = v_member_id;
  update public.group_invitations
  set accepted_at = now(), accepted_by = v_uid
  where token = p_token;

  return v_group_id;
end;
$$;
