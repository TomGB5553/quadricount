"use client";

import Link from "next/link";
import { useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import PayoutInfo from "@/components/PayoutInfo";
import { useT } from "@/lib/i18n/client";
import { settleUpEverywhere } from "@/app/groups/actions";
import type { Payout } from "@/lib/payout";

export type SettleLine = {
  groupId: string;
  groupName: string;
  text: string; // already formatted, e.g. "you pay €12.00"
  iOwe: boolean;
};

// Same two-step flow as the single-group payment form: a clear
// "who → who, how much" screen, then an explicit "has it really been paid?".
export default function SettleAllForm({
  userId,
  otherName,
  iPay,
  total,
  lines,
  multiCurrency,
  payout,
}: {
  userId: string;
  otherName: string;
  iPay: boolean;
  total: string;
  lines: SettleLine[];
  multiCurrency: boolean;
  payout?: Payout;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const you = t("settleAll.you");
  const fromName = iPay ? you : otherName;
  const toName = iPay ? otherName : you;

  const Summary = (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2 px-4 py-6 text-center">
      {confirming && (
        <p className="text-sm text-muted">{t("settle.confirmQuestion")}</p>
      )}
      <p className="text-3xl font-extrabold tracking-tight">{total}</p>
      <p className="text-base">
        <span className="font-semibold">{fromName}</span>
        <span className="mx-2 text-muted">→</span>
        <span className="font-semibold">{toName}</span>
      </p>
    </div>
  );

  return (
    <form action={settleUpEverywhere} className="flex flex-col gap-5">
      <input type="hidden" name="userId" value={userId} />

      {confirming ? (
        <>
          {Summary}
          <p className="text-center text-sm text-muted">
            {lines.length === 1
              ? t("settleAll.confirmWarningOne")
              : t("settleAll.confirmWarning", { count: String(lines.length) })}
          </p>
          <SubmitButton
            pendingText={t("settleAll.recording")}
            className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50"
          >
            {t("settle.confirmYes")}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="w-full rounded-xl border border-line px-4 py-3 text-base"
          >
            {t("settle.confirmBack")}
          </button>
        </>
      ) : (
        <>
          {Summary}

          <details className="rounded-xl border border-line px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold">
              {lines.length === 1
                ? t("settleAll.detailsOne")
                : t("settleAll.details", { count: String(lines.length) })}
            </summary>
            <div className="mt-2 flex flex-col divide-y divide-line">
              {lines.map((l) => (
                <div
                  key={l.groupId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="font-medium">{l.groupName}</span>
                  <span className={l.iOwe ? "text-neg" : "text-pos"}>
                    {l.text}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 py-2 font-semibold">
                <span>{t("common.total")}</span>
                <span>{total}</span>
              </div>
            </div>
            {multiCurrency && (
              <p className="mt-1 text-xs text-muted">{t("settleAll.fxNote")}</p>
            )}
          </details>

          {iPay && payout && (
            <details className="rounded-xl border border-line px-3 py-2 text-sm">
              <summary className="cursor-pointer font-semibold">
                {t("settle.howToPay", { name: otherName })}
              </summary>
              <div className="mt-2">
                <PayoutInfo name={otherName} payout={payout} />
              </div>
            </details>
          )}

          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-ink hover:bg-primary-hover"
          >
            {t("settle.continue")}
          </button>
          <Link href="/balances" className="text-center text-sm text-muted">
            {t("common.cancel")}
          </Link>
        </>
      )}
    </form>
  );
}
