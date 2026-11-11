-- Per-group "I don't drink alcohol" flag. When an expense description looks
-- like alcohol (keyword list in src/lib/alcohol.ts), the add-expense form
-- unticks these members by default. It never changes existing expenses.

alter table public.group_members
  add column no_alcohol boolean not null default false;

-- A member sets it for themselves; anyone in the group can set it for a
-- placeholder member who hasn't joined yet.
create function public.set_member_no_alcohol(
  p_member_id uuid,
  p_no_alcohol boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
  v_user uuid;
begin
  select group_id, user_id into v_group, v_user
    from public.group_members where id = p_member_id;
  if v_group is null or not public.is_group_member(v_group) then
    raise exception 'not a member of this group';
  end if;
  if v_user is not null and v_user <> auth.uid() then
    raise exception 'only this member can change this setting';
  end if;
  update public.group_members set no_alcohol = p_no_alcohol where id = p_member_id;
end;
$$;

grant execute on function public.set_member_no_alcohol(uuid, boolean) to authenticated;
