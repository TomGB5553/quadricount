"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { createExpense } from "../../../actions";

type Member = { id: string; display_name: string };
type Method = "equal" | "exact" | "percentage" | "shares";

// "12.34" / "12,34" -> 1234 minor units; anything invalid -> 0
function toMinor(raw: string): number {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
function toNum(raw: string): number {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
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
  const [currencyCode, setCurrencyCode] = useState(currency);
  const totalMinor = toMinor(amount);

  // ---- payment ----
  const [payMode, setPayMode] = useState<"single" | "split">("single");
  const [singlePayer, setSinglePayer] = useState(members[0]?.id ?? "");
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});

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

  // ---- split ----
  const [method, setMethod] = useState<Method>("equal");
  const [included, setIncluded] = useState<Set<string>>(
    new Set(members.map((m) => m.id)),
  );
  const [exact, setExact] = useState<Record<string, string>>({});
  const [percent, setPercent] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});

  function toggleIncluded(id: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const split = useMemo(() => {
    if (method === "equal") {
      const ids = [...included];
      return {
        valid: ids.length > 0,
        hint:
          ids.length > 0 && totalMinor > 0
            ? `${formatMoney(Math.round(totalMinor / ids.length), currencyCode)} each (${ids.length})`
            : `${ids.length} selected`,
        components: [
          {
            method: "equal",
            basis: "remainder",
            entries: ids.map((member_id) => ({ member_id })),
          },
        ],
      };
    }
    if (method === "exact") {
      const entries = Object.entries(exact)
        .map(([member_id, v]) => ({ member_id, exact_amount: toMinor(v) }))
        .filter((e) => e.exact_amount > 0);
      const sum = entries.reduce((s, e) => s + e.exact_amount, 0);
      return {
        valid: totalMinor > 0 && sum === totalMinor,
        hint: `${formatMoney(sum, currencyCode)} of ${formatMoney(totalMinor, currencyCode)}`,
        components: [{ method: "exact", basis: "remainder", entries }],
      };
    }
    if (method === "percentage") {
      const entries = Object.entries(percent)
        .map(([member_id, v]) => ({ member_id, percent: toNum(v) }))
        .filter((e) => e.percent > 0);
      const sum = entries.reduce((s, e) => s + e.percent, 0);
      return {
        valid: Math.abs(sum - 100) < 0.01,
        hint: `${sum.toFixed(2)}% of 100%`,
        components: [{ method: "percentage", basis: "remainder", entries }],
      };
    }
    // shares
    const entries = Object.entries(shares)
      .map(([member_id, v]) => ({ member_id, weight: toNum(v) }))
      .filter((e) => e.weight > 0);
    const totalW = entries.reduce((s, e) => s + e.weight, 0);
    return {
      valid: entries.length > 0,
      hint:
        totalW > 0 && totalMinor > 0
          ? `${totalW} share${totalW === 1 ? "" : "s"} · ${formatMoney(Math.round(totalMinor / totalW), currencyCode)} per share`
          : "no shares set",
      components: [{ method: "shares", basis: "remainder", entries }],
    };
  }, [method, included, exact, percent, shares, totalMinor, currencyCode]);

  const canSubmit = payersBalanced && split.valid && totalMinor > 0;

  return (
    <form action={createExpense} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="payers" value={JSON.stringify(payers)} />
      <input
        type="hidden"
        name="components"
        value={JSON.stringify(split.components)}
      />

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
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
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

      {/* ---- paid by ---- */}
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
                    setPayerAmounts((p) => ({ ...p, [m.id]: e.target.value }))
                  }
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                />
              </div>
            ))}
            <p
              className={`text-xs ${payersBalanced ? "text-gray-500" : "text-red-600"}`}
            >
              Paid {(paidMinor / 100).toFixed(2)} of{" "}
              {(totalMinor / 100).toFixed(2)}
            </p>
          </div>
        )}
      </fieldset>

      {/* ---- split ---- */}
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Split</legend>
        <div className="flex flex-wrap gap-1">
          {(["equal", "exact", "percentage", "shares"] as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded border px-2 py-1 text-xs capitalize ${
                method === m
                  ? "border-black bg-black text-white"
                  : "border-gray-300"
              }`}
            >
              {m === "exact" ? "exact amounts" : m}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              {method === "equal" ? (
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={included.has(m.id)}
                    onChange={() => toggleIncluded(m.id)}
                  />
                  {m.display_name}
                </label>
              ) : (
                <>
                  <span className="flex-1">{m.display_name}</span>
                  <input
                    inputMode="decimal"
                    placeholder={method === "percentage" ? "%" : "0"}
                    value={
                      method === "exact"
                        ? (exact[m.id] ?? "")
                        : method === "percentage"
                          ? (percent[m.id] ?? "")
                          : (shares[m.id] ?? "")
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (method === "exact")
                        setExact((p) => ({ ...p, [m.id]: v }));
                      else if (method === "percentage")
                        setPercent((p) => ({ ...p, [m.id]: v }));
                      else setShares((p) => ({ ...p, [m.id]: v }));
                    }}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                  />
                </>
              )}
            </div>
          ))}
        </div>

        <p
          className={`text-xs ${split.valid ? "text-gray-500" : "text-red-600"}`}
        >
          {split.hint}
        </p>
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
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
