import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { computeGroupBalances, settleUp } from "@/lib/balances";
import { getFxRate } from "@/lib/fx";
import { formatMoney } from "@/lib/money";

// "Overall" balance across every group the user belongs to, converted to their
// preferred currency. Members are matched across groups by account (user_id),
// so a counterparty only aggregates when they have an account in each group.
export default async function BalancesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", user.id)
    .maybeSingle();
  const pc = profile?.preferred_currency ?? "EUR";

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, default_currency")
    .order("name", { ascending: true });

  const { data: members } = await supabase
    .from("group_members")
    .select("id, group_id, user_id, display_name");

  const { data: expenses } = await supabase
    .from("expenses")
    .select(
      "group_id, currency, fx_rate_to_group_currency, expense_payers(member_id, amount), expense_allocations(member_id, amount)",
    );

  const { data: settlements } = await supabase
    .from("settlements")
    .select(
      "group_id, currency, fx_rate_to_group_currency, from_member, to_member, amount",
    );

  const today = new Date().toISOString().slice(0, 10);
  const rateCache = new Map<string, number>();
  async function toPreferred(minor: number, from: string): Promise<number> {
    if (from === pc) return minor;
    let r = rateCache.get(from);
    if (r === undefined) {
      r = await getFxRate(from, pc, today);
      rateCache.set(from, r);
    }
    return Math.round(minor * r);
  }

  type GroupRow = {
    id: string;
    name: string;
    currency: string;
    myNet: number; // group currency
    myNetPc: number; // preferred currency
  };
  const perGroup: GroupRow[] = [];
  let overall = 0;
  let converted = false;
  // key by user_id (aggregates across groups) or a group-local fallback
  const counterparties = new Map<string, { name: string; net: number }>();

  for (const g of groups ?? []) {
    const myMember = (members ?? []).find(
      (m) => m.group_id === g.id && m.user_id === user.id,
    );
    if (!myMember) continue;

    const gExp = (expenses ?? []).filter((e) => e.group_id === g.id);
    const gSet = (settlements ?? []).filter((s) => s.group_id === g.id);
    const { net } = computeGroupBalances(gExp, gSet);

    const myNet = net.get(myMember.id) ?? 0;
    const myNetPc = await toPreferred(myNet, g.default_currency);
    perGroup.push({
      id: g.id,
      name: g.name,
      currency: g.default_currency,
      myNet,
      myNetPc,
    });
    overall += myNetPc;
    if (g.default_currency !== pc) converted = true;

    for (const t of settleUp(net)) {
      let otherId: string | null = null;
      let sign = 0;
      if (t.from === myMember.id) {
        otherId = t.to;
        sign = -1; // I pay them -> I owe
      } else if (t.to === myMember.id) {
        otherId = t.from;
        sign = 1; // they pay me -> they owe me
      }
      if (!otherId) continue;

      const om = (members ?? []).find((m) => m.id === otherId);
      // Only aggregate people with an account — a group-local placeholder can't
      // be reconciled "overall"; that debt stays in the per-group view above.
      if (!om?.user_id) continue;
      const amt = (await toPreferred(t.amount, g.default_currency)) * sign;
      const entry = counterparties.get(om.user_id) ?? {
        name: om.display_name,
        net: 0,
      };
      entry.net += amt;
      entry.name = om.display_name;
      counterparties.set(om.user_id, entry);
    }
  }

  const people = [...counterparties.values()]
    .filter((p) => p.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 p-6">
      <div>
        <Link href="/groups" className="text-sm text-muted hover:underline">
          ← Your groups
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Overall balance</h1>
      </div>

      {perGroup.length === 0 ? (
        <p className="text-sm text-muted">
          You&apos;re not in any groups yet.
        </p>
      ) : (
        <>
          <p
            className={`text-lg font-semibold ${
              overall > 0
                ? "text-pos"
                : overall < 0
                  ? "text-neg"
                  : "text-muted"
            }`}
          >
            {overall > 0
              ? `Overall, you are owed ${formatMoney(overall, pc)}`
              : overall < 0
                ? `Overall, you owe ${formatMoney(-overall, pc)}`
                : "Overall, you're settled up"}
          </p>

          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">By group</h2>
            <ul className="flex flex-col gap-1">
              {perGroup.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/groups/${row.id}`}
                    className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm hover:bg-surface-2"
                  >
                    <span>{row.name}</span>
                    <span
                      className={
                        row.myNet > 0
                          ? "text-pos"
                          : row.myNet < 0
                            ? "text-neg"
                            : "text-muted"
                      }
                    >
                      {row.myNet > 0
                        ? `owed ${formatMoney(row.myNet, row.currency)}`
                        : row.myNet < 0
                          ? `owe ${formatMoney(-row.myNet, row.currency)}`
                          : "settled"}
                      {row.currency !== pc &&
                        row.myNet !== 0 &&
                        ` (≈ ${formatMoney(Math.abs(row.myNetPc), pc)})`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {people.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">Across everyone</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {people.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-line px-3 py-2"
                  >
                    <span>{p.name}</span>
                    <span
                      className={
                        p.net > 0 ? "text-pos" : "text-neg"
                      }
                    >
                      {p.net > 0
                        ? `owes you ${formatMoney(p.net, pc)}`
                        : `you owe ${formatMoney(-p.net, pc)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Combined across groups where the person has an account. A
                suggestion for settling up, not a per-group breakdown.
              </p>
            </section>
          )}

          {converted && (
            <p className="text-xs text-muted">
              Group balances converted to {pc} at today&apos;s rate.
            </p>
          )}
        </>
      )}
    </main>
  );
}
