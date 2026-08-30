// Balance calculation. Amounts are integer minor units (cents).
//
// A member's net balance = (everything they paid) minus (their share of every
// expense), plus/minus settlements. Foreign-currency expenses and payments are
// converted to the group's default currency using the rate locked on each row
// at entry time, so the result is a single combined figure per member.

export type ExpenseForBalance = {
  currency: string;
  fx_rate_to_group_currency: number;
  expense_payers: { member_id: string; amount: number }[];
  expense_allocations: { member_id: string; amount: number }[];
};

export type SettlementForBalance = {
  currency: string;
  fx_rate_to_group_currency: number;
  from_member: string;
  to_member: string;
  amount: number;
};

// Returns net balances (in the group's default currency) and the set of
// currencies that fed into them, so the UI can show a "converted" note.
export function computeGroupBalances(
  expenses: ExpenseForBalance[],
  settlements: SettlementForBalance[] = [],
): { net: Map<string, number>; currencies: string[] } {
  const net = new Map<string, number>();
  const currencies = new Set<string>();
  const add = (memberId: string, delta: number) =>
    net.set(memberId, (net.get(memberId) ?? 0) + delta);

  for (const e of expenses) {
    currencies.add(e.currency);
    const r = e.fx_rate_to_group_currency || 1;
    for (const p of e.expense_payers) add(p.member_id, p.amount * r);
    for (const a of e.expense_allocations) add(a.member_id, -a.amount * r);
  }

  // A payment from A to B settles A's debt: A's net rises, B's net falls.
  for (const s of settlements) {
    currencies.add(s.currency);
    const r = s.fx_rate_to_group_currency || 1;
    add(s.from_member, s.amount * r);
    add(s.to_member, -s.amount * r);
  }

  for (const [id, v] of net) net.set(id, Math.round(v));
  return { net, currencies: [...currencies] };
}

export type Transfer = { from: string; to: string; amount: number };

// Turn net balances into a short list of "from pays to" transfers.
// Greedy largest-debtor / largest-creditor matching.
export function settleUp(balances: Map<string, number>): Transfer[] {
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, netAmount] of balances) {
    if (netAmount < 0) debtors.push({ id, amount: -netAmount });
    else if (netAmount > 0) creditors.push({ id, amount: netAmount });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return transfers;
}
