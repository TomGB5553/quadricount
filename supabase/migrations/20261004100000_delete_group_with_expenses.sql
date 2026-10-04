-- delete_group failed for any group that had expenses or payments:
-- expense_payers / expense_allocations / expense_split_entries / settlements
-- reference group_members without ON DELETE CASCADE, so removing the members
-- (which cascade from the group) was blocked. Clear the ledger first.

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

  -- cascades to payers, allocations, split components + entries
  delete from public.expenses where group_id = p_group_id;
  delete from public.settlements where group_id = p_group_id;

  -- cascades to members, invitations, transfers
  delete from public.groups where id = p_group_id;
end;
$$;
