"use client";

import Link from "next/link";
import { useState } from "react";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
import PayoutInfo from "@/components/PayoutInfo";
import { useT } from "@/lib/i18n/client";
import { recordSettlement } from "../../../actions";
import type { Payout } from "@/lib/payout";

type Member = { id: string; display_name: string };

const field =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base";

// Two steps on purpose: fill in "who → who, how much", then a confirm screen
// that spells it out in one sentence. People were tapping "record" for
// payments that hadn't actually happened yet.
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
  const [amount, setAmount] = useState(prefill.amount ?? "");
  const [cur, setCur] = useState(currency);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.display_name ?? t("settle.themFallback");
  const payout = payoutByMember[to];
  const num = Number(amount.replace(",", ".").replace(/\s/g, ""));
  const amountOk = amount.trim() !== "" && Number.isFinite(num) && num > 0;
  const canContinue = from !== to && amountOk;

  let pretty = amount;
  try {
    pretty = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
    }).format(num);
  } catch {
    pretty = `${amount} ${cur}`;
  }

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <form action={recordSettlement} className="flex flex-col gap-5">
      {/* Values always submitted, whichever step is showing */}
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="fromMember" value={from} />
      <input type="hidden" name="toMember" value={to} />
      <input type="hidden" name="amount" value={amount} />
      <input type="hidden" name="currency" value={cur} />
      <input type="hidden" name="settledAt" value={date} />
      <input type="hidden" name="note" value={note} />

      {confirming ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2 px-4 py-6 text-center">
            <p className="text-sm text-muted">{t("settle.confirmQuestion")}</p>
            <p className="text-3xl font-extrabold tracking-tight">{pretty}</p>
            <p className="text-base">
              <span className="font-semibold">{nameOf(from)}</span>
              <span className="mx-2 text-muted">→</span>
              <span className="font-semibold">{nameOf(to)}</span>
            </p>
            {date !== today && (
              <p className="text-xs text-muted">{date}</p>
            )}
          </div>
          <p className="text-center text-sm text-muted">
            {t("settle.confirmWarning")}
          </p>
          <SubmitButton
            pendingText={t("settle.recording")}
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
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted">
              {t("settle.from")}
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={`${field} font-semibold text-ink`}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={swap}
              aria-label={t("settle.swap")}
              className="mb-1 shrink-0 rounded-full border border-line px-2.5 py-1.5 text-lg leading-none text-muted"
            >
              ⇄
            </button>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted">
              {t("settle.to")}
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={`${field} font-semibold text-ink`}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {from === to && (
            <p className="-mt-3 text-xs text-neg">{t("settle.pickTwo")}</p>
          )}

          <label className="flex flex-col gap-1 text-sm text-muted">
            {t("settle.amount")}
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="min-w-0 flex-1 bg-transparent py-3 text-2xl font-bold text-ink outline-none"
              />
              <span className="text-base font-semibold text-muted">{cur}</span>
            </div>
          </label>

          {from !== to && payout && (
            <details className="rounded-xl border border-line px-3 py-2 text-sm">
              <summary className="cursor-pointer font-semibold">
                {t("settle.howToPay", { name: nameOf(to) })}
              </summary>
              <div className="mt-2">
                <PayoutInfo name={nameOf(to)} payout={payout} />
              </div>
            </details>
          )}

          {moreOpen ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
                  {t("settle.date")}
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={field}
                  />
                </label>
                <label className="flex w-28 flex-col gap-1 text-sm text-muted">
                  {t("settle.currency")}
                  <select
                    value={cur}
                    onChange={(e) => setCur(e.target.value)}
                    className={field}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm text-muted">
                {t("settle.note")}
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder={t("settle.notePlaceholder")}
                  className={field}
                />
              </label>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="self-start text-sm text-muted underline underline-offset-2"
            >
              {t("settle.moreOptions")}
            </button>
          )}

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => setConfirming(true)}
            className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50"
          >
            {t("settle.continue")}
          </button>
          <Link
            href={`/groups/${groupId}`}
            className="text-center text-sm text-muted"
          >
            {t("common.cancel")}
          </Link>
        </>
      )}
    </form>
  );
}
