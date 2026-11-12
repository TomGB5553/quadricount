-- Duplicate-member guard: expose the names of members already linked to an
-- account, so the join form can warn "this person is already in the group".

create or replace function public.invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'group_name', g.name,
    'group_invite', (i.member_id is null),
    'member_name', gm.display_name,
    'accepted', (i.accepted_at is not null),
    'claimed', (gm.user_id is not null),
    'taken_names', coalesce(
      (
        select jsonb_agg(t.display_name order by t.joined_at)
        from public.group_members t
        where t.group_id = i.group_id
          and t.user_id is not null
          and t.status = 'active'
      ),
      '[]'::jsonb
    ),
    'claimable_members', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', c.id, 'display_name', c.display_name)
          order by c.joined_at
        )
        from public.group_members c
        where c.group_id = i.group_id
          and c.user_id is null
          and c.status = 'active'
          and c.role <> 'owner'
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  left join public.group_members gm on gm.id = i.member_id
  where i.token = p_token;

  return v_result;
end;
$$;
