-- The expense form now always goes through create_expense_with_splits()
-- (an equal split is just a single "equal / remainder" component), so the
-- original equal-only RPC is no longer used.
drop function if exists public.create_expense(
  uuid, text, bigint, text, date, jsonb, uuid[]
);
