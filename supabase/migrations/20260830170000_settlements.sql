-- Settlements: money moving between members that is NOT an expense.
-- Mostly "X paid Y back €Z in cash". Later also used for member-removal
-- adjustments and cross-group balance transfers (hence `source`).

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_member uuid not null references public.group_members (id),
  to_member uuid not null references public.group_members (id),
  amount bigint not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  settled_at date not null default current_date,
  note text check (note is null or char_length(note) <= 200),
  source text not null default 'manual_payment'
    check (source in ('manual_payment', 'member_removal', 'group_transfer')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (from_member <> to_member)
);

create index settlements_group_id_idx on public.settlements (group_id);

-- ---------------------------------------------------------------------------
-- RPC: record a manual payment from one member to another.
-- ---------------------------------------------------------------------------
create function public.record_settlement(
  p_group_id uuid,
  p_from_member uuid,
  p_to_member uuid,
  p_amount bigint,
  p_currency text,
  p_settled_at date,
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
  v_id uuid;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_from_member = p_to_member then
    raise exception 'a payment needs two different people';
  end if;
  if p_from_member not in (
      select id from public.group_members where group_id = p_group_id
    )
    or p_to_member not in (
      select id from public.group_members where group_id = p_group_id
    )
  then
    raise exception 'both people must belong to this group';
  end if;

  select coalesce(nullif(trim(p_currency), ''), g.default_currency)
    into v_currency
  from public.groups g where g.id = p_group_id;

  insert into public.settlements (
    group_id, from_member, to_member, amount, currency, settled_at, note,
    source, created_by
  )
  values (
    p_group_id, p_from_member, p_to_member, p_amount, v_currency,
    coalesce(p_settled_at, current_date),
    nullif(trim(coalesce(p_note, '')), ''),
    'manual_payment', v_uid
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.settlements enable row level security;

create policy "group members can view settlements"
  on public.settlements for select
  to authenticated
  using (public.is_group_member(group_id));

-- inserts go through record_settlement(); creator or owner may delete.
create policy "creator or owner can delete settlements"
  on public.settlements for delete
  to authenticated
  using (
    created_by = (select auth.uid()) or public.is_group_owner(group_id)
  );
