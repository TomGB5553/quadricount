import { createClient } from "@/lib/supabase/server";
import { computeGroupBalances, settleUp } from "@/lib/balances";

// One line of a "settle up with X everywhere" plan: the payment to record in
// one group to clear the me <-> X position there (per settleUp's suggestion,
// so it matches the "Across everyone" figure on the home page).
export type SettleLine = {
  groupId: string;
  groupName: string;
  currency: string;
  fromMemberId: string;
  toMemberId: string;
  otherName: string;
  amount: number; // minor units, group currency
  iOwe: boolean; // true = I pay them
};

export async function buildSettlePlan(
  myUserId: string,
  otherUserId: string,
): Promise<SettleLine[]> {
  const supabase = await createClient();

  const [{ data: groups }, { data: members }, { data: expenses }, { data: settlements }] =
    await Promise.all([
      supabase.from("groups").select("id, name, default_currency"),
      supabase
        .from("group_members")
        .select("id, group_id, user_id, display_name, status"),
      supabase
        .from("expenses")
        .select(
          "group_id, currency, fx_rate_to_group_currency, expense_payers(member_id, amount), expense_allocations(member_id, amount)",
        ),
      supabase
        .from("settlements")
        .select(
          "group_id, currency, fx_rate_to_group_currency, from_member, to_member, amount",
        ),
    ]);

  const lines: SettleLine[] = [];

  for (const g of groups ?? []) {
    const mine = (members ?? []).find(
      (m) => m.group_id === g.id && m.user_id === myUserId && m.status === "active",
    );
    const theirs = (members ?? []).find(
      (m) =>
        m.group_id === g.id && m.user_id === otherUserId && m.status === "active",
    );
    if (!mine || !theirs) continue;

    const { net } = computeGroupBalances(
      (expenses ?? []).filter((e) => e.group_id === g.id),
      (settlements ?? []).filter((s) => s.group_id === g.id),
    );

    for (const tr of settleUp(net)) {
      const between =
        (tr.from === mine.id && tr.to === theirs.id) ||
        (tr.from === theirs.id && tr.to === mine.id);
      if (!between || tr.amount <= 0) continue;

      const iOwe = tr.from === mine.id;
      lines.push({
        groupId: g.id,
        groupName: g.name,
        currency: g.default_currency,
        fromMemberId: iOwe ? mine.id : theirs.id,
        toMemberId: iOwe ? theirs.id : mine.id,
        otherName: theirs.display_name,
        amount: tr.amount,
        iOwe,
      });
    }
  }

  return lines;
}
