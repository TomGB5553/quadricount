"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createExpense } from "../../../actions";

type Member = { id: string; display_name: string };

// "12.34" / "12,34" -> 1234 minor units; anything invalid -> 0
function toMinor(raw: string): number {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export default function NewExpenseForm({
  groupId,
  currency,
  members,
}: {
  groupId: string;
  currency: string;
  members: Member[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState("");
  const [participants, setParticipants] = useState<Set<string>>(
    new Set(members.map((m) => m.id)),
  );

  // Payment: "single" = one person paid the whole amount; "split" = per-person.
  const [payMode, setPayMode] = useState<"single" | "split">("single");
  const [singlePayer, setSinglePayer] = useState(members[0]?.id ?? "");
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});

  const totalMinor = toMinor(amount);

  const payers = useMemo(() => {
    if (payMode === "single") {
      return singlePayer && totalMinor > 0
        ? [{ member_id: singlePayer, amount: totalMinor }]
        : [];
    }
    return Object.entries(payerAmounts)
      .map(([member_id, v]) => ({ member_id, amount: toMinor(v) }))
      .filter((p) => p.amount > 0);
  }, [payMode, singlePayer, payerAmounts, totalMinor]);

  const paidMinor = payers.reduce((s, p) => s + p.amount, 0);
  const payersBalanced = payMode === "single" || paidMinor === totalMinor;

  function toggle(id: string) {
    setParticipants((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <form action={createExpense} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="payers" value={JSON.stringify(payers)} />

      <label className="flex flex-col gap-1 text-sm">
        Description
        <input
          name="description"
          required
          maxLength={200}
          placeholder="Dinner"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Amount
          <input
            name="amount"
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm">
          Currency
          <input
            name="currency"
            defaultValue={currency}
            maxLength={3}
            className="rounded border border-gray-300 px-3 py-2 uppercase"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Date
        <input
          type="date"
          name="spentAt"
          defaultValue={today}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <legend>Paid by</legend>
          <button
            type="button"
            onClick={() =>
              setPayMode((m) => (m === "single" ? "split" : "single"))
            }
            className="text-xs text-gray-500 underline"
          >
            {payMode === "single" ? "Multiple people paid" : "One person paid"}
          </button>
        </div>

        {payMode === "single" ? (
          <select
            value={singlePayer}
            onChange={(e) => setSinglePayer(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="flex-1">{m.display_name}</span>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={payerAmounts[m.id] ?? ""}
                  onChange={(e) =>
                    setPayerAmounts((prev) => ({
                      ...prev,
                      [m.id]: e.target.value,
                    }))
                  }
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                />
              </div>
            ))}
            <p
              className={`text-xs ${
                payersBalanced ? "text-gray-500" : "text-red-600"
              }`}
            >
              Paid {(paidMinor / 100).toFixed(2)} of{" "}
              {(totalMinor / 100).toFixed(2)}
              {!payersBalanced &&
                ` — ${((totalMinor - paidMinor) / 100).toFixed(2)} to go`}
            </p>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Split equally between</legend>
        {members.map((m) => (
          <label key={m.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              name="participants"
              value={m.id}
              checked={participants.has(m.id)}
              onChange={() => toggle(m.id)}
            />
            {m.display_name}
          </label>
        ))}
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={participants.size === 0 || !payersBalanced}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          Add expense
        </button>
        <Link
          href={`/groups/${groupId}`}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
