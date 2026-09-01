-- Let a user change their display name from a profile page. The name follows
-- them into every group they belong to (group_members.display_name), which a
-- plain UPDATE can't do because that table is owner-only under RLS.

create function public.update_my_display_name(p_display_name text)
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

  update public.group_members
  set display_name = v_name
  where user_id = v_uid;
end;
$$;

grant execute on function public.update_my_display_name(text) to authenticated;
