-- Several ways to get paid instead of a single IBAN: any number of bank
-- accounts (IBAN), Revolut usernames and Wero phone numbers.
-- Same visibility rule as payout_details: yourself + active group-mates.

create table public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('iban', 'revolut', 'wero')),
  value text not null,
  label text check (label is null or char_length(label) <= 50),
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint payout_methods_value_format check (
    (kind = 'iban' and char_length(value) between 15 and 34
      and value ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]+$')
    or (kind = 'revolut' and value ~ '^[a-z0-9._-]{3,32}$')
    or (kind = 'wero' and value ~ '^\+?[0-9]{8,15}$')
  ),
  unique (user_id, kind, value)
);

create index payout_methods_user_idx on public.payout_methods (user_id, position);

alter table public.payout_methods enable row level security;

create policy "see your own or a group-mate's payout methods"
  on public.payout_methods for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.shares_active_group_with(user_id)
  );

-- Move existing IBANs over, then drop the old column.
insert into public.payout_methods (user_id, kind, value, position)
select user_id, 'iban', iban, 0
from public.payout_details
where iban is not null;

alter table public.payout_details drop column iban;

-- ---------------------------------------------------------------------------
-- Normalise + validate one method. Returns the cleaned value or raises.
-- ---------------------------------------------------------------------------
create function public.normalize_payout_value(p_kind text, p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := trim(coalesce(p_value, ''));
begin
  if p_kind = 'iban' then
    v := regexp_replace(upper(v), '\s', '', 'g');
    if not (char_length(v) between 15 and 34 and v ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]+$') then
      raise exception 'that does not look like an IBAN: %', p_value;
    end if;
  elsif p_kind = 'revolut' then
    v := lower(regexp_replace(v, '^(https?://)?(www\.)?(revolut\.me/)?@?', ''));
    if v !~ '^[a-z0-9._-]{3,32}$' then
      raise exception 'that does not look like a Revolut username: %', p_value;
    end if;
  elsif p_kind = 'wero' then
    v := regexp_replace(v, '[\s.()-]', '', 'g');
    if v ~ '^00' then v := '+' || substr(v, 3); end if;
    if v !~ '^\+?[0-9]{8,15}$' then
      raise exception 'that does not look like a phone number: %', p_value;
    end if;
  else
    raise exception 'unknown payment method %', p_kind;
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: replace all my payout methods + the free-text note in one go.
-- p_methods = [{ "kind": "iban", "value": "...", "label": "..." }, ...]
-- ---------------------------------------------------------------------------
create function public.set_my_payout_methods(
  p_methods jsonb,
  p_payment_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(trim(coalesce(p_payment_note, '')), '');
  m jsonb;
  i int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_array_length(coalesce(p_methods, '[]'::jsonb)) > 10 then
    raise exception 'at most 10 payment methods';
  end if;

  delete from public.payout_methods where user_id = v_uid;

  for m in select * from jsonb_array_elements(coalesce(p_methods, '[]'::jsonb))
  loop
    if trim(coalesce(m->>'value', '')) = '' then
      continue;
    end if;
    insert into public.payout_methods (user_id, kind, value, label, position)
    values (
      v_uid,
      m->>'kind',
      public.normalize_payout_value(m->>'kind', m->>'value'),
      nullif(trim(coalesce(m->>'label', '')), ''),
      i
    )
    on conflict (user_id, kind, value) do nothing;
    i := i + 1;
  end loop;

  insert into public.payout_details (user_id, payment_note)
  values (v_uid, v_note)
  on conflict (user_id) do update set payment_note = excluded.payment_note;
end;
$$;

grant execute on function public.set_my_payout_methods(jsonb, text) to authenticated;

-- Keep the old onboarding RPC working: saves the note and ADDS the IBAN.
create or replace function public.set_my_payout_details(
  p_iban text,
  p_payment_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(trim(coalesce(p_payment_note, '')), '');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if nullif(trim(coalesce(p_iban, '')), '') is not null then
    insert into public.payout_methods (user_id, kind, value, position)
    values (
      v_uid, 'iban', public.normalize_payout_value('iban', p_iban),
      (select coalesce(max(position) + 1, 0) from public.payout_methods where user_id = v_uid)
    )
    on conflict (user_id, kind, value) do nothing;
  end if;

  insert into public.payout_details (user_id, payment_note)
  values (v_uid, v_note)
  on conflict (user_id) do update set payment_note = excluded.payment_note;
end;
$$;
