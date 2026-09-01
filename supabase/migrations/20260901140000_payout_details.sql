-- Optional payout info (IBAN + a free-text note) so group-mates know how to
-- pay someone back. Kept in its own table, NOT in profiles, because profiles
-- are world-readable to every signed-in user — payout info should only be
-- visible to people who actually share a group with you.

create function public.shares_active_group_with(p_other uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and them.user_id = p_other
      and them.status = 'active'
  );
$$;

create table public.payout_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  iban text
    check (iban is null or (char_length(iban) between 15 and 34
      and iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]+$')),
  payment_note text
    check (payment_note is null or char_length(payment_note) <= 200),
  updated_at timestamptz not null default now()
);

create trigger payout_details_set_updated_at
  before update on public.payout_details
  for each row execute function public.set_updated_at();

alter table public.payout_details enable row level security;

create policy "see your own or a group-mate's payout details"
  on public.payout_details for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.shares_active_group_with(user_id)
  );

-- ---------------------------------------------------------------------------
-- RPC: save my own payout details (normalises the IBAN first).
-- ---------------------------------------------------------------------------
create function public.set_my_payout_details(
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
  v_iban text := nullif(regexp_replace(upper(coalesce(p_iban, '')), '\s', '', 'g'), '');
  v_note text := nullif(trim(coalesce(p_payment_note, '')), '');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_iban is not null and
     not (char_length(v_iban) between 15 and 34 and v_iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]+$')
  then
    raise exception 'that does not look like an IBAN';
  end if;

  insert into public.payout_details (user_id, iban, payment_note)
  values (v_uid, v_iban, v_note)
  on conflict (user_id) do update
    set iban = excluded.iban,
        payment_note = excluded.payment_note;
end;
$$;

grant execute on function public.set_my_payout_details(text, text) to authenticated;
