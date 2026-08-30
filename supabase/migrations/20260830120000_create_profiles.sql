-- Profiles: one row per registered user, mirroring auth.users.
-- auth.users is managed by Supabase Auth; we never write to it directly.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing user info. Kept separate from auth.users so app code never touches the auth schema.';

-- ---------------------------------------------------------------------------
-- Keep updated_at current on every change.
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user is created.
-- security definer: runs with the function owner's rights so it can insert
-- into public.profiles regardless of who triggered the signup.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Without policies, RLS denies everything. We add exactly what we need.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Any signed-in user can read any profile. We need this so members of a group
-- can see each other's names/avatars. Trade-off: display names are visible to
-- all authenticated users. Acceptable for v1; can be tightened later to
-- "only profiles of people who share a group with me".
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- A user may edit only their own profile.
create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Fallback insert (the trigger normally handles creation).
create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));
