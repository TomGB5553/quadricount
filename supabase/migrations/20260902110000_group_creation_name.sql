-- Changing your profile name carries into every group where you never set a
-- custom name (i.e. the group name still equals your old profile name).
-- Groups where you picked a different name are left alone.

create or replace function public.update_my_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_old text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_name is null or char_length(v_name) > 100 then
    raise exception 'display name must be 1 to 100 characters';
  end if;

  select display_name into v_old from public.profiles where id = v_uid;

  update public.profiles
  set display_name = v_name
  where id = v_uid;

  update public.group_members
  set display_name = v_name
  where user_id = v_uid
    and display_name is not distinct from v_old;
end;
$$;

-- Delete a group (owner only). Expenses, members and settlements cascade.
create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'only the group owner can delete it';
  end if;
  delete from public.groups where id = p_group_id;
end;
$$;

grant execute on function public.delete_group(uuid) to authenticated;
