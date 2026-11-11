-- Archive groups instead of deleting them, so the expense history is kept.
-- A group can only be archived once every balance in it is zero (settled or
-- moved to another group); a trigger enforces this whatever path updates it.

alter table public.groups add column archived_at timestamptz;

-- Net balance per member, in the group's currency (minor units).
create or replace function public.group_net_balances(p_group_id uuid)
returns table (member_id uuid, net numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select member_id, sum(x) as net
  from (
    select ep.member_id, ep.amount * coalesce(nullif(e.fx_rate_to_group_currency, 0), 1) as x
    from public.expense_payers ep
    join public.expenses e on e.id = ep.expense_id
    where e.group_id = p_group_id
    union all
    select ea.member_id, -ea.amount * coalesce(nullif(e.fx_rate_to_group_currency, 0), 1)
    from public.expense_allocations ea
    join public.expenses e on e.id = ea.expense_id
    where e.group_id = p_group_id
    union all
    select s.from_member, s.amount * coalesce(nullif(s.fx_rate_to_group_currency, 0), 1)
    from public.settlements s
    where s.group_id = p_group_id
    union all
    select s.to_member, -s.amount * coalesce(nullif(s.fx_rate_to_group_currency, 0), 1)
    from public.settlements s
    where s.group_id = p_group_id
  ) t
  group by member_id;
$$;

create or replace function public.groups_check_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    if exists (
      select 1 from public.group_net_balances(new.id) where abs(net) >= 0.5
    ) then
      raise exception 'settle or transfer every balance before archiving this group';
    end if;
  end if;
  return new;
end;
$$;

create trigger groups_check_archive
  before update of archived_at on public.groups
  for each row execute function public.groups_check_archive();

-- Owner-only archive / unarchive.
create or replace function public.set_group_archived(p_group_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'only the group owner can archive it';
  end if;
  update public.groups
     set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
   where id = p_group_id;
end;
$$;

revoke execute on function public.group_net_balances(uuid) from public, anon;
grant execute on function public.set_group_archived(uuid, boolean) to authenticated;
