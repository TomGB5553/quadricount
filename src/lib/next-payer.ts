// "Whose turn to pay?" — pick the member who is furthest behind, but only when
// the situation is genuinely lopsided so we don't nag over small amounts.
//
// Shown to EVERYONE in the group (the wording just changes for the person
// themselves) — this function only decides *whether* and *who*.

type Member = { id: string };

export type NextPayer = { memberId: string; debt: number } | null;

// All amounts are integer minor units, in the group's currency.
export function suggestNextPayer(opts: {
  members: Member[]; // active members only
  netByMember: Map<string, number>; // member id -> balance (negative = owes)
  expenseAmounts: number[]; // each expense's total, converted to group currency
}): NextPayer {
  const { members, netByMember, expenseAmounts } = opts;

  // Need a bit of history and at least two people for a suggestion to mean anything.
  if (expenseAmounts.length < 2 || members.length < 2) return null;

  const ranked = members
    .map((m) => ({ id: m.id, net: netByMember.get(m.id) ?? 0 }))
    .sort((a, b) => a.net - b.net); // most negative first

  const worst = ranked[0];
  const second = ranked[1];
  if (worst.net >= 0) return null; // nobody is actually behind

  const debt = -worst.net;
  const gapToNext = second.net - worst.net; // how much more behind `worst` is
  const avgExpense = Math.round(
    expenseAmounts.reduce((s, a) => s + a, 0) / expenseAmounts.length,
  );

  // A real debt: at least one average expense, and at least 5 units.
  const bigEnough = debt >= Math.max(500, avgExpense);
  // Clearly more behind than the next person (not "everyone's a bit negative").
  const lopsided = gapToNext >= Math.max(300, Math.round(avgExpense * 0.5));

  return bigEnough && lopsided ? { memberId: worst.id, debt } : null;
}
