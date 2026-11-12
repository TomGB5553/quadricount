-- "I don't drink" is opt-in by the person themselves: asked once during
-- onboarding (profiles.no_alcohol), copied onto each group membership when it
-- gets linked to the account. Placeholders (not joined yet) are never flagged.

alter table public.profiles
  add column no_alcohol boolean not null default false;

-- Undo any flag set on a placeholder through the old row toggle.
update public.group_members set no_alcohol = false where user_id is null;

-- When a membership gets an account (create/join group, claim a placeholder),
-- it takes that person's own answer.
create function public.group_member_inherit_no_alcohol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.no_alcohol := false;
  elsif tg_op = 'INSERT' or old.user_id is distinct from new.user_id then
    select coalesce(p.no_alcohol, false) into new.no_alcohol
      from public.profiles p where p.id = new.user_id;
    new.no_alcohol := coalesce(new.no_alcohol, false);
  end if;
  return new;
end;
$$;

create trigger group_member_inherit_no_alcohol
  before insert or update of user_id on public.group_members
  for each row execute function public.group_member_inherit_no_alcohol();

-- Set my account default and apply it to every group I'm already in.
create function public.set_my_no_alcohol(p_no_alcohol boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.profiles set no_alcohol = p_no_alcohol where id = auth.uid();
  update public.group_members set no_alcohol = p_no_alcohol where user_id = auth.uid();
end;
$$;

grant execute on function public.set_my_no_alcohol(boolean) to authenticated;

-- Per-group toggle: only the member themselves, never a placeholder.
create or replace function public.set_member_no_alcohol(
  p_member_id uuid,
  p_no_alcohol boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_members
     set no_alcohol = p_no_alcohol
   where id = p_member_id and user_id = auth.uid();
  if not found then
    raise exception 'you can only change this for yourself';
  end if;
end;
$$;
