import type { ParsedReceipt, ReceiptItem } from "./types";

// Turn a parsed receipt into per-item "shares" (minor units) that add up EXACTLY
// to the amount we're going to record for the expense. Tax / tip / discount get
// spread across the items in proportion to their price, so that once every item
// is assigned to people, the sum of everyone's parts equals the receipt total.

export type ReconciledItem = ReceiptItem & { share: number };

// A structured note so the UI can translate it. Amounts are minor units.
export type ReconcileNote =
  | { kind: "noItems" }
  | { kind: "drift"; implied: number; total: number }
  | { kind: "spread"; amount: number }
  | { kind: "discount"; amount: number };

export type Reconciliation = {
  items: ReconciledItem[];
  total: number; // the amount the expense will be recorded as
  adjustment: number; // tax + tip - discount that got spread over items (signed)
  note: ReconcileNote | null;
  ok: boolean; // false => the numbers don't add up, user should check the items
};

const CENTS_TOLERANCE = 2;

export function reconcile(r: ParsedReceipt): Reconciliation {
  const items = r.items;
  const itemsSum = items.reduce((s, it) => s + it.total, 0);

  // What the receipt's own lines imply the total should be.
  const extras = (r.taxIncluded ? 0 : r.tax + r.tip) - r.discount;
  const impliedTotal = itemsSum + extras;

  // Trust the printed grand total when we have one; otherwise use the implied one.
  const total = r.total > 0 ? r.total : impliedTotal;

  if (itemsSum <= 0) {
    return {
      items: items.map((it) => ({ ...it, share: 0 })),
      total,
      adjustment: 0,
      note: { kind: "noItems" },
      ok: false,
    };
  }

  // Scale each item so the shares sum to `total`, keeping proportions.
  let running = 0;
  const scaled: ReconciledItem[] = items.map((it, i) => {
    const share =
      i === items.length - 1
        ? total - running // last item absorbs the rounding drift
        : Math.round((it.total / itemsSum) * total);
    running += share;
    return { ...it, share };
  });

  const adjustment = total - itemsSum;
  const drift = r.total > 0 ? r.total - impliedTotal : 0;

  let note: ReconcileNote | null = null;
  let ok = true;

  if (Math.abs(drift) > CENTS_TOLERANCE) {
    ok = false;
    note = { kind: "drift", implied: impliedTotal, total: r.total };
  } else if (adjustment > CENTS_TOLERANCE) {
    note = { kind: "spread", amount: adjustment };
  } else if (adjustment < -CENTS_TOLERANCE) {
    note = { kind: "discount", amount: -adjustment };
  }

  return { items: scaled, total, adjustment, note, ok };
}
