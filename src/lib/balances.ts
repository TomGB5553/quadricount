// Balance calculation. All amounts are integer minor units (cents).
//
// A member's net balance in a currency = (everything they paid) minus
// (their share of every expense). Positive => they are owed money;
// negative => they owe money. Balances are kept per-currency; converting
// between currencies for a combined view comes later (feature 9).

export type ExpenseForBalance = {
  currency: string;
  expense_payers: { member_id: string; amount: number }[];
  expense_allocations: { member_id: string; amount: number }[];
};

// currency -> (memberId -> net minor units)
export function computeGroupBalances(
  expenses: ExpenseForBalance[],
): Map<string, Map<string, number>> {
  const byCurrency = new Map<string, Map<string, number>>();

  for (const e of expenses) {
    let balances = byCurrency.get(e.currency);
    if (!balances) {
      balances = new Map();
      byCurrency.set(e.currency, balances);
    }
    const add = (memberId: string, delta: number) =>
      balances!.set(memberId, (balances!.get(memberId) ?? 0) + delta);

    for (const p of e.expense_payers) add(p.member_id, p.amount);
    for (const a of e.expense_allocations) add(a.member_id, -a.amount);
  }

  return byCurrency;
}

export type Transfer = { from: string; to: string; amount: number };

// Turn net balances into a short list of "from pays to" transfers.
// Greedy largest-debtor / largest-creditor matching. Not always the
// theoretical minimum number of transfers, but close and easy to follow.
export function settleUp(balances: Map<string, number>): Transfer[] {
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, net] of balances) {
    if (net < 0) debtors.push({ id, amount: -net });
    else if (net > 0) creditors.push({ id, amount: net });
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
