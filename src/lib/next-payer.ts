// "Whose turn to pay?" — nudge the people who are furthest behind.
//
// Rules:
//   • Nothing unless there's a bit of history (>=2 expenses, >=2 members).
//   • The most-behind person must owe a real amount: at least one average
//     expense, and at least 5 units.
//   • Group the people whose debt is *similar* to the worst one's (within
//     half an average expense).
//     - 1 person  -> suggest that person
//     - 2 people  -> suggest both
//     - 3 or more -> say nothing (that's just "everyone's behind")
//   • The next person after that cluster must be clearly less behind,
//     otherwise the cluster isn't really distinct.
//
// The nudge is shown to EVERYONE in the group; this only decides who / whether.

type Member = { id: string };

export type NextPayer = { memberIds: string[] } | null;

// All amounts are integer minor units, in the group's currency.
export function suggestNextPayer(opts: {
  members: Member[]; // active members only
  netByMember: Map<string, number>; // member id -> balance (negative = owes)
  expenseAmounts: number[]; // each expense total, converted to group currency
}): NextPayer {
  const { members, netByMember, expenseAmounts } = opts;

  if (expenseAmounts.length < 2 || members.length < 2) return null;

  const negatives = members
    .map((m) => ({ id: m.id, debt: -(netByMember.get(m.id) ?? 0) }))
    .filter((x) => x.debt > 0)
    .sort((a, b) => b.debt - a.debt); // most in debt first
  if (negatives.length === 0) return null;

  const avgExpense = Math.round(
    expenseAmounts.reduce((s, a) => s + a, 0) / expenseAmounts.length,
  );
  const bigThreshold = Math.max(500, avgExpense);
  const band = Math.max(300, Math.round(avgExpense * 0.5));

  const worst = negatives[0];
  if (worst.debt < bigThreshold) return null;

  // People whose debt is within `band` of the worst — a "similar" cluster.
  const cluster = negatives.filter((x) => x.debt >= worst.debt - band);

  if (cluster.length >= 3) return null; // everyone's behind — no point nudging

  // The first person outside the cluster must be clearly less behind.
  const nextDebt = negatives[cluster.length]?.debt ?? 0;
  const clusterFloor = cluster[cluster.length - 1].debt;
  if (clusterFloor - nextDebt < band) return null;

  return { memberIds: cluster.map((x) => x.id) };
}
