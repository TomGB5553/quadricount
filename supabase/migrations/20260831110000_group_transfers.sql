-- Feature 10 — move an outstanding balance from one group into another.
--
-- Realised as two settlements (source = 'group_transfer'):
--   * in the source group: debtor "pays" creditor -> their balance there clears
--   * in the target group: the reverse -> the debtor now owes the creditor there
-- The group_balance_transfers row links the two for traceability.

create table public.group_balance_transfers (
  id uuid primary key default gen_random_uuid(),
  source_group uuid not null references public.groups (id) on delete cascade,
  target_group uuid not null references public.groups (id) on delete cascade,
  amount bigint not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  source_settlement uuid references public.settlements (id) on delete set null,
  target_settlement uuid references public.settlements (id) on delete set null,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (source_group <> target_group)
);

create index group_balance_transfers_source_idx
  on public.group_balance_transfers (source_group);
create index group_balance_transfers_target_idx
  on public.group_balance_transfers (target_group);

alter table public.group_balance_transfers enable row level security;

create policy "members of either group can view a transfer"
  on public.group_balance_transfers for select
  to authenticated
  using (
    public.is_group_member(source_group)
    or public.is_group_member(target_group)
  );

-- ---------------------------------------------------------------------------
-- RPC: perform the transfer. The caller must belong to both groups.
--   p_src_from / p_src_to: debtor / creditor member rows in the source group
--   p_tgt_from / p_tgt_to: the SAME two people's member rows in the target group
-- ---------------------------------------------------------------------------
create function public.transfer_balance(
  p_source_group uuid,
  p_target_group uuid,
  p_src_from uuid,
  p_src_to uuid,
  p_tgt_from uuid,
  p_tgt_to uuid,
  p_amount bigint,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_currency text;
  v_src_name text;
  v_tgt_name text;
  v_src_settlement uuid;
  v_tgt_settlement uuid;
  v_transfer_id uuid;
begin
  if p_source_group = p_target_group then
    raise exception 'pick a different group to move the balance into';
  end if;
  if not public.is_group_member(p_source_group)
     or not public.is_group_member(p_target_group) then
    raise exception 'you must belong to both groups';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_src_from = p_src_to or p_tgt_from = p_tgt_to then
    raise exception 'a transfer needs two different people';
  end if;
  if p_src_from not in (
      select id from public.group_members where group_id = p_source_group)
     or p_src_to not in (
      select id from public.group_members where group_id = p_source_group) then
    raise exception 'source members do not belong to the source group';
  end if;
  if p_tgt_from not in (
      select id from public.group_members where group_id = p_target_group)
     or p_tgt_to not in (
      select id from public.group_members where group_id = p_target_group) then
    raise exception 'target members do not belong to the target group';
  end if;

  select default_currency, name into v_currency, v_src_name
  from public.groups where id = p_source_group;
  select name into v_tgt_name from public.groups where id = p_target_group;

  -- clear the debt in the source group
  insert into public.settlements (
    group_id, from_member, to_member, amount, currency, settled_at, note,
    source, created_by
  )
  values (
    p_source_group, p_src_from, p_src_to, p_amount, v_currency, current_date,
    coalesce(nullif(trim(p_note), ''), 'Moved to ' || v_tgt_name),
    'group_transfer', v_uid
  )
  returning id into v_src_settlement;

  -- open the debt in the target group (reversed direction)
  insert into public.settlements (
    group_id, from_member, to_member, amount, currency, settled_at, note,
    source, created_by
  )
  values (
    p_target_group, p_tgt_to, p_tgt_from, p_amount, v_currency, current_date,
    coalesce(nullif(trim(p_note), ''), 'Moved from ' || v_src_name),
    'group_transfer', v_uid
  )
  returning id into v_tgt_settlement;

  insert into public.group_balance_transfers (
    source_group, target_group, amount, currency,
    source_settlement, target_settlement, note, created_by
  )
  values (
    p_source_group, p_target_group, p_amount, v_currency,
    v_src_settlement, v_tgt_settlement, nullif(trim(p_note), ''), v_uid
  )
  returning id into v_transfer_id;

  return v_transfer_id;
end;
$$;
