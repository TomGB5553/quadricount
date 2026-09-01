"use client";

import Link from "next/link";
import { useState } from "react";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
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
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(prefill.from ?? members[0]?.id ?? "");
  const [to, setTo] = useState(prefill.to ?? members[1]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const payeeName =
    members.find((m) => m.id === to)?.display_name ?? "them";
  const payout = payoutByMember[to];

  return (
    <form action={recordSettlement} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />

      <label className="flex flex-col gap-1 text-sm">
        Who paid
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
        Who received it
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
        <p className="text-xs text-neg">Pick two different people.</p>
      )}

      {from !== to && payout && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-2 p-3 text-sm">
          <span className="text-xs font-semibold text-muted">
            How to pay {payeeName}
          </span>
          {payout.iban && (
            <div className="flex items-center gap-2">
              <span className="flex-1 break-all font-mono text-xs">
                {payout.iban}
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(payout.iban ?? "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {}
                }}
                className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-ink"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          {payout.payment_note && (
            <span className="text-xs text-muted">{payout.payment_note}</span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Amount
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
          Currency
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
        Date
        <input
          type="date"
          name="settledAt"
          defaultValue={today}
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Note (optional)
        <input
          name="note"
          maxLength={200}
          placeholder="Bank transfer"
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        />
      </label>

      <div className="flex gap-3">
        <SubmitButton disabled={from === to} pendingText="Recording…">
          Record payment
        </SubmitButton>
        <Link
          href={`/groups/${groupId}`}
          className="rounded-xl border border-line px-3 py-2 text-sm"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
