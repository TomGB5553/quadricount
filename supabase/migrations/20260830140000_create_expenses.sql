-- Expenses, their payers (multi-payer), and the per-member split.
-- Money is stored as integer minor units (e.g. cents): 1234 = 12.34.
-- This step supports an equal split only; flexible/mixed splits are layered
-- on later without changing these tables.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  total_amount bigint not null check (total_amount > 0),
  currency text not null check (char_length(currency) = 3),
  spent_at date not null default current_date,
  -- rate to convert this expense into the group's default currency, captured
  -- at entry time. 1 when currencies already match. Used later (feature 9).
  fx_rate_to_group_currency numeric not null default 1
    check (fx_rate_to_group_currency > 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_group_id_idx on public.expenses (group_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- Who fronted the money. Rows sum to expenses.total_amount (enforced in RPC).
create table public.expense_payers (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  member_id uuid not null references public.group_members (id),
  amount bigint not null check (amount > 0),
  unique (expense_id, member_id)
);

create index expense_payers_expense_id_idx on public.expense_payers (expense_id);
create index expense_payers_member_id_idx on public.expense_payers (member_id);

-- Each member's share of the expense. This is the computed result the expense
-- list and balance calculation read (feature 4 and 6). Rows sum to total_amount.
create table public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  member_id uuid not null references public.group_members (id),
  amount bigint not null check (amount >= 0),
  unique (expense_id, member_id)
);

create index expense_allocations_expense_id_idx
  on public.expense_allocations (expense_id);
create index expense_allocations_member_id_idx
  on public.expense_allocations (member_id);

-- ---------------------------------------------------------------------------
-- RPC: create an expense with its payers and an equal split, atomically.
--   p_payers: jsonb array of {"member_id": uuid, "amount": bigint}
--   p_participant_ids: members the expense is split equally among
-- ---------------------------------------------------------------------------
create function public.create_expense(
  p_group_id uuid,
  p_description text,
  p_total_amount bigint,
  p_currency text,
  p_spent_at date,
  p_payers jsonb,
  p_participant_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_expense_id uuid;
  v_currency text;
  v_payer_sum bigint;
  v_n int;
  v_base bigint;
  v_remainder bigint;
  v_i int := 0;
  v_member uuid;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'total amount must be positive';
  end if;

  v_n := array_length(p_participant_ids, 1);
  if v_n is null or v_n = 0 then
    raise exception 'at least one participant is required';
  end if;

  -- payers must sum to the total
  select coalesce(sum((e ->> 'amount')::bigint), 0)
    into v_payer_sum
  from jsonb_array_elements(p_payers) e;

  if v_payer_sum <> p_total_amount then
    raise exception 'payer amounts (%) must sum to the total (%)',
      v_payer_sum, p_total_amount;
  end if;

  -- every payer and participant must belong to this group
  if exists (
    select 1 from jsonb_array_elements(p_payers) e
    where (e ->> 'member_id')::uuid not in (
      select id from public.group_members where group_id = p_group_id
    )
  ) then
    raise exception 'a payer is not a member of this group';
  end if;

  if exists (
    select 1 from unnest(p_participant_ids) pid
    where pid not in (
      select id from public.group_members where group_id = p_group_id
    )
  ) then
    raise exception 'a participant is not a member of this group';
  end if;

  select coalesce(nullif(trim(p_currency), ''), g.default_currency)
    into v_currency
  from public.groups g
  where g.id = p_group_id;

  insert into public.expenses (
    group_id, description, total_amount, currency, spent_at, created_by
  )
  values (
    p_group_id, trim(p_description), p_total_amount, v_currency,
    coalesce(p_spent_at, current_date), v_uid
  )
  returning id into v_expense_id;

  insert into public.expense_payers (expense_id, member_id, amount)
  select v_expense_id, (e ->> 'member_id')::uuid, (e ->> 'amount')::bigint
  from jsonb_array_elements(p_payers) e;

  -- equal split with largest-remainder rounding: the first v_remainder
  -- participants (ordered by id, deterministically) get one extra minor unit
  -- so the shares sum exactly to the total.
  v_base := p_total_amount / v_n;
  v_remainder := p_total_amount - v_base * v_n;

  for v_member in
    select pid from unnest(p_participant_ids) pid order by pid
  loop
    insert into public.expense_allocations (expense_id, member_id, amount)
    values (
      v_expense_id,
      v_member,
      v_base + case when v_i < v_remainder then 1 else 0 end
    );
    v_i := v_i + 1;
  end loop;

  return v_expense_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.expenses enable row level security;
alter table public.expense_payers enable row level security;
alter table public.expense_allocations enable row level security;

create policy "group members can view expenses"
  on public.expenses for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "group members can add expenses"
  on public.expenses for insert
  to authenticated
  with check (
    public.is_group_member(group_id) and created_by = (select auth.uid())
  );

create policy "creator or owner can update expenses"
  on public.expenses for update
  to authenticated
  using (
    created_by = (select auth.uid()) or public.is_group_owner(group_id)
  )
  with check (
    created_by = (select auth.uid()) or public.is_group_owner(group_id)
  );

create policy "creator or owner can delete expenses"
  on public.expenses for delete
  to authenticated
  using (
    created_by = (select auth.uid()) or public.is_group_owner(group_id)
  );

-- payers / allocations: readable by members of the expense's group.
-- Writes go only through create_expense() (security definer), so no
-- insert/update/delete policies here -> those are denied for clients.
create policy "group members can view expense payers"
  on public.expense_payers for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_group_member(e.group_id)
    )
  );

create policy "group members can view expense allocations"
  on public.expense_allocations for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_group_member(e.group_id)
    )
  );
