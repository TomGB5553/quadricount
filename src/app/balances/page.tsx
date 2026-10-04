import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { computeGroupBalances, settleUp } from "@/lib/balances";
import { getFxRate } from "@/lib/fx";
import { formatMoney } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

// "Overall" balance across every group the user belongs to, converted to their
// preferred currency. Members are matched across groups by account (user_id),
// so a counterparty only aggregates when they have an account in each group.
export default async function BalancesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const t = await getT();

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
  // key by user_id (aggregates across groups); people who haven't joined yet
  // (placeholders) are group-local, so they get their own per-group row
  const counterparties = new Map<
    string,
    {
      id: string;
      name: string;
      net: number;
      groupName: string | null; // set for placeholders only
      href: string; // where "Régler" goes
    }
  >();

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
      if (!om) continue;
      const amt = (await toPreferred(t.amount, g.default_currency)) * sign;
      // People with an account aggregate across groups. A placeholder can't
      // be matched across groups, so it stays its own row, settled in-group.
      const key = om.user_id ?? `m:${om.id}`;
      const entry = counterparties.get(key) ?? {
        id: key,
        name: om.display_name,
        net: 0,
        groupName: om.user_id ? null : g.name,
        href: om.user_id
          ? `/balances/settle/${om.user_id}`
          : `/groups/${g.id}/expenses/new?mode=payment&from=${t.from}&to=${t.to}&amount=${(
              t.amount / 100
            ).toFixed(2)}`,
      };
      entry.net += amt;
      entry.name = om.display_name;
      counterparties.set(key, entry);
    }
  }
  perGroup.sort((a, b) => Math.abs(b.myNet) - Math.abs(a.myNet));

  const people = [...counterparties.values()]
    .filter((p) => p.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const row =
    "flex items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-3 text-sm shadow-sm ring-1 ring-line/60";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {t("groups.title")}
        </h1>
        <Link
          href="/groups/new"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary-hover active:bg-primary-hover"
        >
          {t("groups.new")}
        </Link>
      </div>

      {perGroup.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          {t("groups.empty")}
        </div>
      ) : (
        <>
          {overall !== 0 && (
            <p className="text-sm">
              <span className="text-muted">{t("overall.acrossAll")} · </span>
              <span
                className={`font-bold ${
                  overall > 0 ? "text-pos" : "text-neg"
                }`}
              >
                {overall > 0
                  ? t("overall.youreOwed", { amount: formatMoney(overall, pc) })
                  : t("overall.youOwe", { amount: formatMoney(-overall, pc) })}
              </span>
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {perGroup.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/groups/${r.id}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 transition-colors hover:bg-surface-2 active:bg-surface-2"
                >
                  <span className="min-w-0 truncate font-semibold">
                    {r.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={
                        r.myNet > 0
                          ? "text-sm font-semibold text-pos"
                          : r.myNet < 0
                            ? "text-sm font-semibold text-neg"
                            : "text-sm text-muted"
                      }
                    >
                      {r.myNet > 0
                        ? `+${formatMoney(r.myNet, r.currency)}`
                        : r.myNet < 0
                          ? `−${formatMoney(-r.myNet, r.currency)}`
                          : t("overall.settled")}
                      {r.currency !== pc &&
                        r.myNet !== 0 &&
                        ` (≈ ${formatMoney(Math.abs(r.myNetPc), pc)})`}
                    </span>
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {people.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-muted">
                {t("overall.acrossEveryone")}
              </h2>
              {people.map((p) => (
                <div key={p.id} className={row}>
                  <span className="min-w-0 truncate">
                    {p.name}
                    {p.groupName && (
                      <span className="text-xs text-muted">
                        {" "}
                        · {p.groupName}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={
                        p.net > 0
                          ? "font-semibold text-pos"
                          : "font-semibold text-neg"
                      }
                    >
                      {p.net > 0
                        ? t("overall.owesYou", {
                            amount: formatMoney(p.net, pc),
                          })
                        : t("overall.youOweShort", {
                            amount: formatMoney(-p.net, pc),
                          })}
                    </span>
                    <Link
                      href={p.href}
                      className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-ink transition-colors hover:bg-primary-hover active:bg-primary-hover"
                    >
                      {t("settleAll.button")}
                    </Link>
                  </span>
                </div>
              ))}
              <p className="text-xs text-muted">{t("overall.acrossNote")}</p>
            </section>
          )}

          {converted && (
            <p className="text-xs text-muted">
              {t("overall.fxNote", { currency: pc })}
            </p>
          )}
        </>
      )}
    </main>
  );
}
