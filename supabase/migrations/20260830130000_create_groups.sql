-- Groups and their members.
-- Expenses/settlements (added later) will reference group_members.id, never a
-- user id directly, so that non-registered and removed people still work.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  description text,
  default_currency text not null default 'EUR',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- null until a real user claims this spot (placeholder / invited member)
  user_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 100),
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  removed_at timestamptz,
  removed_by uuid references public.group_members (id),
  joined_at timestamptz not null default now(),
  -- a registered user can hold at most one spot per group
  -- (multiple placeholder rows with null user_id are still allowed)
  unique (group_id, user_id)
);

create index group_members_group_id_idx on public.group_members (group_id);
create index group_members_user_id_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Membership helper functions.
-- security definer so they can read group_members without tripping the table's
-- own RLS policies (which would otherwise recurse: "can I see members? only if
-- I'm a member" -> checking that reads members -> ...).
-- ---------------------------------------------------------------------------
create function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

create function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = (select auth.uid())
      and role = 'owner'
      and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC: create a group and add the caller as its owner, atomically.
-- ---------------------------------------------------------------------------
create function public.create_group(
  p_name text,
  p_description text default null,
  p_default_currency text default 'EUR'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.groups (name, description, default_currency, created_by)
  values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(nullif(trim(p_default_currency), ''), 'EUR'),
    v_uid
  )
  returning id into v_group_id;

  select coalesce(nullif(trim(display_name), ''), 'Me')
    into v_name
  from public.profiles
  where id = v_uid;

  insert into public.group_members (group_id, user_id, display_name, role, status)
  values (v_group_id, v_uid, coalesce(v_name, 'Me'), 'owner', 'active');

  return v_group_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: add a placeholder member (just a name) to a group. Owner only.
-- ---------------------------------------------------------------------------
create function public.add_group_member(
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
  if not public.is_group_owner(p_group_id) then
    raise exception 'only the group owner can add members';
  end if;

  insert into public.group_members (group_id, display_name, role, status)
  values (p_group_id, trim(p_display_name), 'member', 'active')
  returning id into v_member_id;

  return v_member_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- groups: visible to its members; creatable by anyone (as themselves);
-- editable by an owner. Row creation really goes through create_group(), but
-- this policy also covers direct updates to name/description/currency.
create policy "group members can view their groups"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

create policy "authenticated users can create groups"
  on public.groups for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy "group owners can update their groups"
  on public.groups for update
  to authenticated
  using (public.is_group_owner(id))
  with check (public.is_group_owner(id));

-- group_members: visible to members of the same group; owners manage rows.
create policy "group members can view the member list"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "group owners can add members"
  on public.group_members for insert
  to authenticated
  with check (public.is_group_owner(group_id));

create policy "group owners can update members"
  on public.group_members for update
  to authenticated
  using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id));
