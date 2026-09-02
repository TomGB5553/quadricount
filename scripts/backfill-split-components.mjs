// The first seed run inserted expense_payers + expense_allocations but no
// expense_split_components / _entries. The editor (and update_expense_with_splits)
// needs at least one split component, so editing a seeded expense fails with
// "at least one split component is required".
//
// This backfills one component per expense that has none, reproducing the
// current allocation exactly:
//   - allocations all equal (±1 minor unit)  -> one "equal" component
//   - otherwise                              -> one "exact" component
//
//   node scripts/backfill-split-components.mjs

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: expenses, error } = await db
  .from("expenses")
  .select(
    "id, description, total_amount, expense_allocations(member_id, amount), expense_split_components(id)",
  );
if (error) throw error;

let fixed = 0;
let skipped = 0;

for (const e of expenses) {
  if (e.expense_split_components.length > 0) {
    skipped++;
    continue;
  }
  const allocs = e.expense_allocations;
  if (allocs.length === 0) {
    console.log(`  ! ${e.description}: no allocations, skipping`);
    continue;
  }

  const amounts = allocs.map((a) => a.amount);
  const equalish = Math.max(...amounts) - Math.min(...amounts) <= 1;
  const method = equalish ? "equal" : "exact";

  const { data: comp, error: ce } = await db
    .from("expense_split_components")
    .insert({
      expense_id: e.id,
      method,
      basis: "remainder",
      amount: null,
      seq: 1,
    })
    .select("id")
    .single();
  if (ce) throw new Error(`component for ${e.description}: ${ce.message}`);

  const { error: ee } = await db.from("expense_split_entries").insert(
    allocs.map((a) => ({
      component_id: comp.id,
      member_id: a.member_id,
      weight: method === "equal" ? null : null,
      percent: null,
      exact_amount: method === "exact" ? a.amount : null,
    })),
  );
  if (ee) throw new Error(`entries for ${e.description}: ${ee.message}`);

  fixed++;
}

console.log(`\nDone. Added a split component to ${fixed} expense(s); ${skipped} already had one.`);
