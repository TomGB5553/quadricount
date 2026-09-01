-- Per-group display names are intentional: a user can go by a different name
-- in each group. So the profile name is only a *default* — stop cascading it
-- to group_members, and let a member rename themselves within one group.

create or replace function public.update_my_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_name is null or char_length(v_name) > 100 then
    raise exception 'display name must be 1 to 100 characters';
  end if;

  update public.profiles
  set display_name = v_name
  where id = v_uid;
end;
$$;

create function public.update_my_group_name(p_group_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_name is null or char_length(v_name) > 100 then
    raise exception 'display name must be 1 to 100 characters';
  end if;

  update public.group_members
  set display_name = v_name
  where group_id = p_group_id
    and user_id = v_uid;
end;
$$;

grant execute on function public.update_my_group_name(uuid, text) to authenticated;
