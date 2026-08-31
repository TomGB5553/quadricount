import type { ExpenseInitial } from "@/app/groups/[id]/expenses/new/NewExpenseForm";

const EXPENSE_SELECT =
  "id, group_id, description, total_amount, currency, fx_rate_to_group_currency, spent_at, created_by, created_at, expense_payers(member_id, amount), expense_allocations(member_id, amount), expense_split_components(id, method, basis, amount, seq, expense_split_entries(member_id, weight, percent, exact_amount))";

export { EXPENSE_SELECT };

type Component = {
  id: string;
  method: string;
  basis: string;
  amount: number | null;
  seq: number;
  expense_split_entries: {
    member_id: string;
    weight: number | null;
    percent: number | null;
    exact_amount: number | null;
  }[];
};

export type FullExpense = {
  id: string;
  group_id: string;
  description: string;
  total_amount: number;
  currency: string;
  fx_rate_to_group_currency: number;
  spent_at: string;
  created_by: string;
  expense_payers: { member_id: string; amount: number }[];
  expense_allocations: { member_id: string; amount: number }[];
  expense_split_components: Component[];
};

const dec = (minor: number) => (minor / 100).toFixed(2);

// Rebuild the shape NewExpenseForm expects for editing.
export function toExpenseInitial(e: FullExpense): ExpenseInitial {
  const singlePayer =
    e.expense_payers.length === 1 &&
    e.expense_payers[0].amount === e.total_amount;

  const sorted = [...e.expense_split_components].sort((a, b) => a.seq - b.seq);
  const fixedTotal = sorted
    .filter((c) => c.basis === "fixed_amount")
    .reduce((s, c) => s + (c.amount ?? 0), 0);
  const multi = sorted.length > 1;

  const parts = sorted.map((c) => {
    const included: Record<string, boolean> = {};
    const values: Record<string, string> = {};
    for (const en of c.expense_split_entries) {
      if (c.method === "equal") included[en.member_id] = true;
      else if (c.method === "exact")
        values[en.member_id] = dec(en.exact_amount ?? 0);
      else if (c.method === "percentage")
        values[en.member_id] = String(en.percent ?? "");
      else values[en.member_id] = String(en.weight ?? "");
    }
    // when editing a multi-part split, every part shows an explicit amount;
    // a "remainder" component's amount = total minus the fixed ones
    const coverage =
      c.basis === "fixed_amount"
        ? (c.amount ?? 0)
        : e.total_amount - fixedTotal;
    return {
      method: c.method as ExpenseInitial["parts"][number]["method"],
      amount: multi ? dec(coverage) : "",
      included,
      values,
    };
  });

  return {
    description: e.description,
    amount: dec(e.total_amount),
    currency: e.currency,
    spentAt: e.spent_at,
    payMode: singlePayer ? "single" : "split",
    singlePayer: singlePayer ? e.expense_payers[0].member_id : "",
    payerAmounts: singlePayer
      ? {}
      : Object.fromEntries(
          e.expense_payers.map((p) => [p.member_id, dec(p.amount)]),
        ),
    parts,
  };
}
