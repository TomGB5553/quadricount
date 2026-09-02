import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { getFxRate } from "@/lib/fx";
import { formatMoney } from "@/lib/money";
import SubmitButton from "@/components/SubmitButton";
import PayoutInfo from "@/components/PayoutInfo";
import { buildSettlePlan } from "@/lib/settle-plan";
import { settleUpEverywhere } from "@/app/groups/actions";

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

  const [{ data: me }, { data: other }, { data: payout }, plan] =
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
        .select("iban, payment_note")
        .eq("user_id", userId)
        .maybeSingle(),
      buildSettlePlan(user.id, userId),
    ]);

  const pc = me?.preferred_currency ?? "EUR";
  const otherName = plan[0]?.otherName ?? other?.display_name ?? "?";

  // net across all the lines, in the preferred currency (positive = they pay me)
  const today = new Date().toISOString().slice(0, 10);
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

  const row =
    "flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-3 text-sm";

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
          <p className="text-sm text-muted">
            {t("settleAll.intro", { name: otherName })}
          </p>

          {payout && (payout.iban || payout.payment_note) && (
            <PayoutInfo
              name={otherName}
              iban={payout.iban}
              note={payout.payment_note}
            />
          )}

          <div className="flex flex-col gap-1.5">
            {plan.map((l) => (
              <div key={l.groupId} className={row}>
                <span className="font-medium">{l.groupName}</span>
                <span
                  className={l.iOwe ? "text-neg" : "text-pos"}
                >
                  {l.iOwe
                    ? t("settleAll.lineIPay", {
                        amount: formatMoney(l.amount, l.currency),
                      })
                    : t("settleAll.lineTheyPay", {
                        name: otherName,
                        amount: formatMoney(l.amount, l.currency),
                      })}
                </span>
              </div>
            ))}
          </div>

          {netToMe !== 0 && (
            <p className="text-sm font-semibold">
              {netToMe > 0
                ? t("settleAll.netTheyPayYou", {
                    name: otherName,
                    amount: formatMoney(netToMe, pc),
                  })
                : t("settleAll.netYouPay", {
                    name: otherName,
                    amount: formatMoney(-netToMe, pc),
                  })}
            </p>
          )}

          <form action={settleUpEverywhere} className="flex gap-3">
            <input type="hidden" name="userId" value={userId} />
            <SubmitButton pendingText={t("settleAll.recording")}>
              {t("settleAll.record")}
            </SubmitButton>
            <Link
              href="/balances"
              className="rounded-xl border border-line px-3 py-2 text-sm"
            >
              {t("common.cancel")}
            </Link>
          </form>
        </>
      )}
    </main>
  );
}
