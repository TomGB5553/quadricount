-- Username-based accounts: signup asks for a handle + password, no email.
-- The handle is stored on the profile (and, internally, Supabase Auth still
-- keeps a synthetic <username>@quadricount.app email that the user never sees).

alter table public.profiles
  add column username text unique
    check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'username'
  );
  return new;
end;
$$;
