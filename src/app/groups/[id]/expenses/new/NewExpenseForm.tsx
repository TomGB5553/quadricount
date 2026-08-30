"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { createExpense } from "../../../actions";

type Member = { id: string; display_name: string };
type Method = "equal" | "exact" | "percentage" | "shares";

type Part = {
  key: string;
  method: Method;
  remainder: boolean; // covers "the rest" of the total
  amount: string; // used when !remainder
  included: Record<string, boolean>; // equal
  values: Record<string, string>; // exact / percentage / shares
};

// "12.34" / "12,34" -> 1234 minor units; invalid -> 0
function toMinor(raw: string): number {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
function toNum(raw: string): number {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const METHODS: Method[] = ["equal", "exact", "percentage", "shares"];
const methodLabel = (m: Method) => (m === "exact" ? "exact amounts" : m);

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
  const fmt = (minor: number) => formatMoney(minor, currencyCode);

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

  // ---- split parts ----
  function newPart(remainder: boolean): Part {
    return {
      key: crypto.randomUUID(),
      method: "equal",
      remainder,
      amount: "",
      included: Object.fromEntries(members.map((m) => [m.id, true])),
      values: {},
    };
  }
  const [parts, setParts] = useState<Part[]>([newPart(true)]);
  const multiPart = parts.length > 1;

  function patchPart(key: string, patch: Partial<Part>) {
    setParts((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );
  }
  function addPart() {
    setParts((prev) => [
      ...prev,
      newPart(!prev.some((p) => p.remainder)),
    ]);
  }
  function removePart(key: string) {
    setParts((prev) => {
      const next = prev.filter((p) => p.key !== key);
      // a lone part always covers the whole expense
      if (next.length === 1) next[0] = { ...next[0], remainder: true };
      else if (!next.some((p) => p.remainder))
        next[0] = { ...next[0], remainder: true };
      return next;
    });
  }
  function setRemainder(key: string) {
    setParts((prev) =>
      prev.map((p) => ({ ...p, remainder: p.key === key })),
    );
  }

  // fixed coverage = sum of the non-remainder parts' amounts
  const fixedMinor = parts
    .filter((p) => !p.remainder)
    .reduce((s, p) => s + toMinor(p.amount), 0);
  const remainderCount = parts.filter((p) => p.remainder).length;
  const remainderMinor = totalMinor - fixedMinor;

  function coverageOf(p: Part): number {
    if (parts.length === 1 || p.remainder) return remainderMinor;
    return toMinor(p.amount);
  }

  // validity + hint for one part, given its coverage
  function evalPart(p: Part, coverage: number) {
    if (p.method === "equal") {
      const n = members.filter((m) => p.included[m.id]).length;
      return {
        valid: n > 0,
        hint:
          n > 0 && coverage > 0
            ? `${fmt(Math.round(coverage / n))} each (${n})`
            : `${n} selected`,
      };
    }
    if (p.method === "exact") {
      const sum = members.reduce((s, m) => s + toMinor(p.values[m.id] ?? ""), 0);
      return {
        valid: coverage > 0 && sum === coverage,
        hint: `${fmt(sum)} of ${fmt(coverage)}`,
      };
    }
    if (p.method === "percentage") {
      const sum = members.reduce((s, m) => s + toNum(p.values[m.id] ?? ""), 0);
      return {
        valid: Math.abs(sum - 100) < 0.01,
        hint: `${sum.toFixed(2)}% of 100%`,
      };
    }
    const totalW = members.reduce((s, m) => s + toNum(p.values[m.id] ?? ""), 0);
    return {
      valid: totalW > 0,
      hint:
        totalW > 0 && coverage > 0
          ? `${totalW} shares · ${fmt(Math.round(coverage / totalW))} per share`
          : "no shares set",
    };
  }

  function entriesOf(p: Part) {
    if (p.method === "equal")
      return members
        .filter((m) => p.included[m.id])
        .map((m) => ({ member_id: m.id }));
    if (p.method === "exact")
      return members
        .map((m) => ({ member_id: m.id, exact_amount: toMinor(p.values[m.id] ?? "") }))
        .filter((e) => e.exact_amount > 0);
    if (p.method === "percentage")
      return members
        .map((m) => ({ member_id: m.id, percent: toNum(p.values[m.id] ?? "") }))
        .filter((e) => e.percent > 0);
    return members
      .map((m) => ({ member_id: m.id, weight: toNum(p.values[m.id] ?? "") }))
      .filter((e) => e.weight > 0);
  }

  const components = parts.map((p) => ({
    method: p.method,
    basis: parts.length === 1 || p.remainder ? "remainder" : "fixed_amount",
    ...(parts.length === 1 || p.remainder
      ? {}
      : { amount: toMinor(p.amount) }),
    entries: entriesOf(p),
  }));

  const partsValid = parts.every((p) => evalPart(p, coverageOf(p)).valid);
  const fixedAmountsSet =
    parts.length === 1 ||
    parts.every((p) => p.remainder || toMinor(p.amount) > 0);
  const coverageValid =
    fixedAmountsSet &&
    remainderCount <= 1 &&
    fixedMinor <= totalMinor &&
    (remainderCount === 1 ? remainderMinor > 0 : fixedMinor === totalMinor);

  const canSubmit =
    totalMinor > 0 && payersBalanced && partsValid && coverageValid;

  return (
    <form action={createExpense} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="payers" value={JSON.stringify(payers)} />
      <input type="hidden" name="components" value={JSON.stringify(components)} />

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
      <fieldset className="flex flex-col gap-3 text-sm">
        <legend className="mb-1">Split</legend>

        {parts.map((p, idx) => {
          const coverage = coverageOf(p);
          const { valid, hint } = evalPart(p, coverage);
          return (
            <div
              key={p.key}
              className="flex flex-col gap-2 rounded border border-gray-200 p-3"
            >
              {multiPart && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Part {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePart(p.key)}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => patchPart(p.key, { method: m })}
                    className={`rounded border px-2 py-1 text-xs capitalize ${
                      p.method === m
                        ? "border-black bg-black text-white"
                        : "border-gray-300"
                    }`}
                  >
                    {methodLabel(m)}
                  </button>
                ))}
              </div>

              {multiPart && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`remainder-${p.key}`}
                      checked={p.remainder}
                      onChange={() => setRemainder(p.key)}
                    />
                    covers the rest
                  </label>
                  {!p.remainder && (
                    <label className="flex items-center gap-1">
                      covers
                      <input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={p.amount}
                        onChange={(e) =>
                          patchPart(p.key, { amount: e.target.value })
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
                      />
                    </label>
                  )}
                  {p.remainder && (
                    <span className="text-gray-500">
                      covers {fmt(Math.max(coverage, 0))}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    {p.method === "equal" ? (
                      <label className="flex flex-1 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!p.included[m.id]}
                          onChange={() =>
                            patchPart(p.key, {
                              included: {
                                ...p.included,
                                [m.id]: !p.included[m.id],
                              },
                            })
                          }
                        />
                        {m.display_name}
                      </label>
                    ) : (
                      <>
                        <span className="flex-1">{m.display_name}</span>
                        <input
                          inputMode="decimal"
                          placeholder={p.method === "percentage" ? "%" : "0"}
                          value={p.values[m.id] ?? ""}
                          onChange={(e) =>
                            patchPart(p.key, {
                              values: { ...p.values, [m.id]: e.target.value },
                            })
                          }
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>

              <p className={`text-xs ${valid ? "text-gray-500" : "text-red-600"}`}>
                {hint}
              </p>
            </div>
          );
        })}

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={addPart}
            className="rounded border border-gray-300 px-2 py-1"
          >
            + Add a part
          </button>
          {multiPart && (
            <span
              className={coverageValid ? "text-gray-500" : "text-red-600"}
            >
              {remainderCount === 0
                ? `Parts cover ${fmt(fixedMinor)} of ${fmt(totalMinor)}`
                : fixedMinor > totalMinor
                  ? `Parts over the total by ${fmt(fixedMinor - totalMinor)}`
                  : `Last part covers the remaining ${fmt(Math.max(remainderMinor, 0))}`}
            </span>
          )}
        </div>
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
