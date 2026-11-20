import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { getFxRate } from "@/lib/fx";
import { formatMoney } from "@/lib/money";
import SettleAllForm from "./SettleAllForm";
import { buildPayouts } from "@/lib/payout";
import { buildSettlePlan } from "@/lib/settle-plan";
import { serverToday } from "@/lib/amount";

export default async function SettleEverywherePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const t = await getT();

  if (userId === user.id) notFound();

  const [{ data: me }, { data: other }, { data: payoutNote }, { data: payoutMethods }, plan] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("preferred_currency")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("payout_details")
        .select("user_id, payment_note")
        .eq("user_id", userId),
      supabase
        .from("payout_methods")
        .select("user_id, kind, value, label, position")
        .eq("user_id", userId),
      buildSettlePlan(user.id, userId),
    ]);

  const pc = me?.preferred_currency ?? "EUR";
  const otherName = plan[0]?.otherName ?? other?.display_name ?? "?";

  // net across all the lines, in the preferred currency (positive = they pay me)
  const today = serverToday();
  const rateCache = new Map<string, number>();
  let netToMe = 0;
  for (const l of plan) {
    let r = rateCache.get(l.currency);
    if (r === undefined) {
      r = l.currency === pc ? 1 : await getFxRate(l.currency, pc, today);
      rateCache.set(l.currency, r);
    }
    netToMe += Math.round(l.amount * r) * (l.iOwe ? -1 : 1);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div>
        <Link
          href="/balances"
          className="text-sm text-muted transition-colors hover:underline active:text-ink"
        >
          {t("settleAll.back")}
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
          {t("settleAll.title", { name: otherName })}
        </h1>
      </div>

      {plan.length === 0 ? (
        <p className="text-sm text-muted">
          {t("settleAll.nothing", { name: otherName })}
        </p>
      ) : (
        <>
          <SettleAllForm
            userId={userId}
            otherName={otherName}
            iPay={netToMe < 0}
            total={formatMoney(Math.abs(netToMe), pc)}
            multiCurrency={plan.some((l) => l.currency !== pc)}
            payout={buildPayouts(payoutMethods, payoutNote)[userId]}
            lines={plan.map((l) => ({
              groupId: l.groupId,
              groupName: l.groupName,
              iOwe: l.iOwe,
              text: l.iOwe
                ? t("settleAll.lineIPay", {
                    amount: formatMoney(l.amount, l.currency),
                  })
                : t("settleAll.lineTheyPay", {
                    name: otherName,
                    amount: formatMoney(l.amount, l.currency),
                  }),
            }))}
          />
        </>
      )}
    </main>
  );
}
