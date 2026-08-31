"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
import { createExpense, updateExpense } from "../../../actions";

type Member = { id: string; display_name: string };
type Method = "equal" | "exact" | "percentage" | "shares";

type Part = {
  key: string;
  method: Method;
  amount: string; // how much of the total this part covers (multi-part only)
  included: Record<string, boolean>; // equal
  values: Record<string, string>; // exact / percentage / shares
};

export type ExpenseInitial = {
  description: string;
  amount: string;
  currency: string;
  spentAt: string;
  payMode: "single" | "split";
  singlePayer: string;
  payerAmounts: Record<string, string>;
  parts: Omit<Part, "key">[];
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
const methodLabel = (m: Method) =>
  m === "exact" ? "Exact" : m === "percentage" ? "%" : m === "shares" ? "Shares" : "Equal";

export default function NewExpenseForm({
  groupId,
  currency,
  members,
  expenseId,
  initial,
  defaultPayer,
}: {
  groupId: string;
  currency: string;
  members: Member[];
  expenseId?: string;
  initial?: ExpenseInitial;
  defaultPayer?: string;
}) {
  const isEdit = !!expenseId;
  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [currencyCode, setCurrencyCode] = useState(initial?.currency ?? currency);
  const totalMinor = toMinor(amount);
  const fmt = (minor: number) => formatMoney(minor, currencyCode);

  // ---- payment ----
  const [payMode, setPayMode] = useState<"single" | "split">(
    initial?.payMode ?? "single",
  );
  const [singlePayer, setSinglePayer] = useState(
    initial?.singlePayer ?? defaultPayer ?? members[0]?.id ?? "",
  );
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(
    initial?.payerAmounts ?? {},
  );

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
  function newPart(): Part {
    return {
      key: crypto.randomUUID(),
      method: "equal",
      amount: "",
      included: Object.fromEntries(members.map((m) => [m.id, true])),
      values: {},
    };
  }
  const [parts, setParts] = useState<Part[]>(
    initial?.parts?.length
      ? initial.parts.map((p) => ({ ...p, key: crypto.randomUUID() }))
      : [newPart()],
  );
  const multiPart = parts.length > 1;

  function patchPart(key: string, patch: Partial<Part>) {
    setParts((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );
  }
  function addPart() {
    setParts((prev) => [...prev, newPart()]);
  }
  function removePart(key: string) {
    setParts((prev) => prev.filter((p) => p.key !== key));
  }

  // when there are 2+ parts, each part covers an explicit amount
  const assignedMinor = multiPart
    ? parts.reduce((s, p) => s + toMinor(p.amount), 0)
    : totalMinor;
  const unassignedMinor = totalMinor - assignedMinor;

  function coverageOf(p: Part): number {
    return multiPart ? toMinor(p.amount) : totalMinor;
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
    basis: multiPart ? "fixed_amount" : "remainder",
    ...(multiPart ? { amount: toMinor(p.amount) } : {}),
    entries: entriesOf(p),
  }));

  const partsValid = parts.every((p) => evalPart(p, coverageOf(p)).valid);
  const coverageValid = !multiPart || assignedMinor === totalMinor;

  const canSubmit =
    totalMinor > 0 && payersBalanced && partsValid && coverageValid;

  const field =
    "rounded-xl border border-line bg-surface px-3 py-2.5 w-full";
  const card = "rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3";

  return (
    <form
      action={isEdit ? updateExpense : createExpense}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="groupId" value={groupId} />
      {expenseId && (
        <input type="hidden" name="expenseId" value={expenseId} />
      )}
      <input type="hidden" name="payers" value={JSON.stringify(payers)} />
      <input type="hidden" name="components" value={JSON.stringify(components)} />

      <div className={card}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          What for?
          <input
            name="description"
            required
            maxLength={200}
            defaultValue={initial?.description ?? ""}
            placeholder="Dinner"
            className={field}
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Amount
            <input
              name="amount"
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={field}
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-sm font-medium">
            Currency
            <select
              name="currency"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
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

        <label className="flex flex-col gap-1 text-sm font-medium">
          Date
          <input
            type="date"
            name="spentAt"
            defaultValue={initial?.spentAt ?? today}
            className={field}
          />
        </label>
      </div>

      {/* ---- paid by ---- */}
      <fieldset className={card}>
        <div className="flex items-center justify-between">
          <legend className="text-sm font-semibold">Paid by</legend>
          <button
            type="button"
            onClick={() =>
              setPayMode((m) => (m === "single" ? "split" : "single"))
            }
            className="text-xs font-medium text-primary hover:underline"
          >
            {payMode === "single" ? "Multiple people paid" : "One person paid"}
          </button>
        </div>

        {payMode === "single" ? (
          <select
            value={singlePayer}
            onChange={(e) => setSinglePayer(e.target.value)}
            className={field}
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
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{m.display_name}</span>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={payerAmounts[m.id] ?? ""}
                  onChange={(e) =>
                    setPayerAmounts((p) => ({ ...p, [m.id]: e.target.value }))
                  }
                  className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-right"
                />
              </div>
            ))}
            <p
              className={`text-xs ${payersBalanced ? "text-muted" : "text-neg"}`}
            >
              Paid {(paidMinor / 100).toFixed(2)} of{" "}
              {(totalMinor / 100).toFixed(2)}
            </p>
          </div>
        )}
      </fieldset>

      {/* ---- split ---- */}
      <fieldset className={`${card} text-sm`}>
        <legend className="text-sm font-semibold">Split</legend>

        {parts.map((p, idx) => {
          const coverage = coverageOf(p);
          const { valid, hint } = evalPart(p, coverage);
          return (
            <div
              key={p.key}
              className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-3"
            >
              {multiPart && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">
                    Part {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePart(p.key)}
                    className="text-xs text-muted hover:text-neg"
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="flex gap-1 rounded-lg bg-surface p-1">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => patchPart(p.key, { method: m })}
                    className={`flex-1 rounded-md px-1 py-1.5 text-xs font-medium ${
                      p.method === m
                        ? "bg-primary text-primary-ink"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {methodLabel(m)}
                  </button>
                ))}
              </div>

              {multiPart && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted">This part covers</span>
                  <input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={p.amount}
                    onChange={(e) =>
                      patchPart(p.key, { amount: e.target.value })
                    }
                    className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-right"
                  />
                  {unassignedMinor > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        patchPart(p.key, {
                          amount: (
                            (toMinor(p.amount) + unassignedMinor) /
                            100
                          ).toFixed(2),
                        })
                      }
                      className="text-primary hover:underline"
                    >
                      + {fmt(unassignedMinor)} left
                    </button>
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
                          className="w-24 rounded-xl border border-line px-2 py-1 text-right"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>

              <p className={`text-xs ${valid ? "text-muted" : "text-neg"}`}>
                {hint}
              </p>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={addPart}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-medium hover:bg-surface-2"
          >
            {multiPart ? "+ Add another part" : "+ Split part of it differently"}
          </button>
          {multiPart && (
            <span className={coverageValid ? "text-muted" : "text-neg"}>
              {assignedMinor === totalMinor
                ? `All ${fmt(totalMinor)} assigned`
                : assignedMinor > totalMinor
                  ? `${fmt(assignedMinor - totalMinor)} over the total`
                  : `${fmt(unassignedMinor)} of ${fmt(totalMinor)} still to assign`}
            </span>
          )}
        </div>
      </fieldset>

      <div className="flex gap-3">
        <SubmitButton
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50"
          disabled={!canSubmit}
          pendingText={isEdit ? "Saving…" : "Adding…"}
        >
          {isEdit ? "Save changes" : "Add expense"}
        </SubmitButton>
        <Link
          href={
            isEdit
              ? `/groups/${groupId}/expenses/${expenseId}`
              : `/groups/${groupId}`
          }
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
