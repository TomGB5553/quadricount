"use client";

import Link from "next/link";
import { useState } from "react";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
import PayoutInfo from "@/components/PayoutInfo";
import { useT } from "@/lib/i18n/client";
import { recordSettlement } from "../../../actions";

type Member = { id: string; display_name: string };
type Payout = { iban: string | null; payment_note: string | null };

export default function SettleForm({
  groupId,
  currency,
  members,
  payoutByMember,
  prefill,
}: {
  groupId: string;
  currency: string;
  members: Member[];
  payoutByMember: Record<string, Payout>;
  prefill: { from?: string; to?: string; amount?: string };
}) {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(prefill.from ?? members[0]?.id ?? "");
  const [to, setTo] = useState(prefill.to ?? members[1]?.id ?? "");

  const payeeName =
    members.find((m) => m.id === to)?.display_name ?? t("settle.themFallback");
  const payout = payoutByMember[to];

  return (
    <form action={recordSettlement} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />

      <label className="flex flex-col gap-1 text-sm">
        {t("settle.whoPaid")}
        <select
          name="fromMember"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("settle.whoReceived")}
        <select
          name="toMember"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </label>

      {from === to && (
        <p className="text-xs text-neg">{t("settle.pickTwo")}</p>
      )}

      {from !== to && payout && (
        <PayoutInfo
          name={payeeName}
          iban={payout.iban}
          note={payout.payment_note}
        />
      )}

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          {t("settle.amount")}
          <input
            name="amount"
            required
            inputMode="decimal"
            defaultValue={prefill.amount ?? ""}
            placeholder="0.00"
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          />
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm">
          {t("settle.currency")}
          <select
            name="currency"
            defaultValue={currency}
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t("settle.date")}
        <input
          type="date"
          name="settledAt"
          defaultValue={today}
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("settle.note")}
        <input
          name="note"
          maxLength={200}
          placeholder={t("settle.notePlaceholder")}
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        />
      </label>

      <div className="flex gap-3">
        <SubmitButton
          disabled={from === to}
          pendingText={t("settle.recording")}
        >
          {t("settle.record")}
        </SubmitButton>
        <Link
          href={`/groups/${groupId}`}
          className="rounded-xl border border-line px-3 py-2 text-sm"
        >
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
