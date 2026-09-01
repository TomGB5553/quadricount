"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
import Avatar from "@/components/Avatar";
import ReceiptScanButton from "./ReceiptScanButton";
import { reconcile, type ReconciledItem } from "@/lib/receipt/reconcile";
import type { ParsedReceipt } from "@/lib/receipt/types";
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
  m === "exact" ? "Exact" : m === "percentage" ? "%" : m === "shares" ? "Parts" : "Égal";

export default function NewExpenseForm({
  groupId,
  currency,
  members,
  expenseId,
  initial,
  defaultPayer,
  canScan,
}: {
  groupId: string;
  currency: string;
  members: Member[];
  expenseId?: string;
  initial?: ExpenseInitial;
  defaultPayer?: string;
  canScan?: boolean;
}) {
  const isEdit = !!expenseId;
  const today = new Date().toISOString().slice(0, 10);

  const [description, setDescription] = useState(initial?.description ?? "");
  const [spentAt, setSpentAt] = useState(initial?.spentAt ?? today);
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [currencyCode, setCurrencyCode] = useState(initial?.currency ?? currency);

  // Items read off a scanned receipt, and who shares each one (by item index).
  const [receiptItems, setReceiptItems] = useState<ReconciledItem[] | null>(null);
  const [receiptNote, setReceiptNote] = useState<string | null>(null);
  const [assign, setAssign] = useState<Record<number, string[]>>({});
  const receiptActive = !!receiptItems;

  const allMemberIds = useMemo(() => members.map((m) => m.id), [members]);

  function applyReceipt(r: ParsedReceipt) {
    const rec = reconcile(r);
    setAmount((rec.total / 100).toFixed(2));
    if ((CURRENCIES as readonly string[]).includes(r.currency)) {
      setCurrencyCode(r.currency);
    }
    if (!description.trim() && r.merchant) setDescription(r.merchant);
    if (r.date) setSpentAt(r.date);
    setReceiptItems(rec.items);
    setReceiptNote(rec.note);
    // start with every item shared by everyone; the user narrows it down
    setAssign(Object.fromEntries(rec.items.map((_, i) => [i, allMemberIds])));
  }

  function clearReceipt() {
    setReceiptItems(null);
    setReceiptNote(null);
    setAssign({});
  }

  function toggleItemMember(i: number, memberId: string) {
    setAssign((prev) => {
      const cur = prev[i] ?? [];
      return {
        ...prev,
        [i]: cur.includes(memberId)
          ? cur.filter((x) => x !== memberId)
          : [...cur, memberId],
      };
    });
  }

  function setEveryItemTo(ids: string[]) {
    if (!receiptItems) return;
    setAssign(Object.fromEntries(receiptItems.map((_, i) => [i, ids])));
  }

  // Split each item's cost equally among whoever shares it, then total per person.
  // Whole-cent remainders go to the first sharers (in member order), so the
  // per-person amounts always add back up to the receipt total exactly.
  const memberShares = useMemo(() => {
    const out: Record<string, number> = {};
    if (!receiptItems) return out;
    for (const m of members) out[m.id] = 0;
    receiptItems.forEach((it, i) => {
      const ids = allMemberIds.filter((id) => (assign[i] ?? []).includes(id));
      if (ids.length === 0) return;
      const base = Math.floor(it.share / ids.length);
      let rem = it.share - base * ids.length;
      for (const id of ids) out[id] += base + (rem-- > 0 ? 1 : 0);
    });
    return out;
  }, [receiptItems, assign, members, allMemberIds]);

  const unassignedItems = receiptItems
    ? receiptItems.filter((_, i) => (assign[i] ?? []).length === 0).length
    : 0;
  const receiptSplitValid = receiptActive && unassignedItems === 0;

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
            ? `${fmt(Math.round(coverage / n))} chacun (${n})`
            : `${n} sélectionné(s)`,
      };
    }
    if (p.method === "exact") {
      const sum = members.reduce((s, m) => s + toMinor(p.values[m.id] ?? ""), 0);
      return {
        valid: coverage > 0 && sum === coverage,
        hint: `${fmt(sum)} sur ${fmt(coverage)}`,
      };
    }
    if (p.method === "percentage") {
      const sum = members.reduce((s, m) => s + toNum(p.values[m.id] ?? ""), 0);
      return {
        valid: Math.abs(sum - 100) < 0.01,
        hint: `${sum.toFixed(2)} % sur 100 %`,
      };
    }
    const totalW = members.reduce((s, m) => s + toNum(p.values[m.id] ?? ""), 0);
    return {
      valid: totalW > 0,
      hint:
        totalW > 0 && coverage > 0
          ? `${totalW} parts · ${fmt(Math.round(coverage / totalW))} par part`
          : "aucune part définie",
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

  const components = receiptActive
    ? [
        {
          method: "exact" as Method,
          basis: "remainder",
          entries: members
            .map((m) => ({
              member_id: m.id,
              exact_amount: memberShares[m.id] ?? 0,
            }))
            .filter((e) => e.exact_amount > 0),
        },
      ]
    : parts.map((p) => ({
        method: p.method,
        basis: multiPart ? "fixed_amount" : "remainder",
        ...(multiPart ? { amount: toMinor(p.amount) } : {}),
        entries: entriesOf(p),
      }));

  const partsValid = parts.every((p) => evalPart(p, coverageOf(p)).valid);
  const coverageValid = !multiPart || assignedMinor === totalMinor;

  const canSubmit =
    totalMinor > 0 &&
    payersBalanced &&
    (receiptActive ? receiptSplitValid : partsValid && coverageValid);

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

      {canScan && !isEdit && (
        <ReceiptScanButton currency={currencyCode} onResult={applyReceipt} />
      )}

      <div className={card}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Pour quoi ?
          <input
            name="description"
            required
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dîner"
            className={field}
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Montant
            <input
              name="amount"
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              readOnly={receiptActive}
              title={
                receiptActive
                  ? "Défini par le ticket scanné — efface-le pour modifier"
                  : undefined
              }
              className={`${field} ${receiptActive ? "opacity-60" : ""}`}
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-sm font-medium">
            Devise
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
            lang="fr-FR"
            name="spentAt"
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
            className={field}
          />
        </label>
      </div>

      {receiptItems && (
        <fieldset className={`${card} text-sm`}>
          <div className="flex items-center justify-between">
            <legend className="text-sm font-semibold">
              Attribuer les articles ({receiptItems.length})
            </legend>
            <button
              type="button"
              onClick={clearReceipt}
              className="text-xs text-muted hover:text-neg"
            >
              Effacer le ticket
            </button>
          </div>

          {receiptNote && (
            <p
              className={`text-xs ${
                receiptNote.includes("Vérifie")
                  ? "text-neg"
                  : "text-muted"
              }`}
            >
              {receiptNote}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setEveryItemTo(allMemberIds)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-medium hover:bg-surface-2"
            >
              Tout le monde partage tout
            </button>
            <button
              type="button"
              onClick={() => setEveryItemTo([])}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-medium hover:bg-surface-2"
            >
              Tout désélectionner
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {receiptItems.map((it, i) => {
              const ids = assign[i] ?? [];
              const each =
                ids.length > 0
                  ? formatMoney(Math.round(it.share / ids.length), currencyCode)
                  : null;
              return (
                <li
                  key={i}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3"
                >
                  <div className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {it.qty > 1 && (
                        <span className="text-muted">{it.qty}× </span>
                      )}
                      {it.name}
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold">
                      {formatMoney(it.share, currencyCode)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const on = ids.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleItemMember(i, m.id)}
                          className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs ${
                            on
                              ? "border-primary bg-primary text-primary-ink"
                              : "border-line text-muted"
                          }`}
                        >
                          <Avatar name={m.display_name} size={18} />
                          {m.display_name}
                        </button>
                      );
                    })}
                  </div>

                  <p
                    className={`text-xs ${
                      ids.length === 0 ? "text-neg" : "text-muted"
                    }`}
                  >
                    {ids.length === 0
                      ? "Non attribué — choisis qui partage"
                      : `${each} chacun`}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-1 border-t border-line pt-2 text-xs">
            {members.map((m) => (
              <div key={m.id} className="flex justify-between">
                <span>{m.display_name}</span>
                <span className="tabular-nums text-muted">
                  {formatMoney(memberShares[m.id] ?? 0, currencyCode)}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{fmt(totalMinor)}</span>
            </div>
          </div>
        </fieldset>
      )}

      {/* ---- paid by ---- */}
      <fieldset className={card}>
        <div className="flex items-center justify-between">
          <legend className="text-sm font-semibold">Payé par</legend>
          <button
            type="button"
            onClick={() =>
              setPayMode((m) => (m === "single" ? "split" : "single"))
            }
            className="text-xs font-medium text-primary hover:underline"
          >
            {payMode === "single"
              ? "Plusieurs ont payé"
              : "Une seule personne a payé"}
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
              Payé {(paidMinor / 100).toFixed(2)} sur{" "}
              {(totalMinor / 100).toFixed(2)}
            </p>
          </div>
        )}
      </fieldset>

      {/* ---- split (hidden while a scanned receipt drives the split) ---- */}
      {!receiptActive && (
      <fieldset className={`${card} text-sm`}>
        <legend className="text-sm font-semibold">Répartition</legend>

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
                    Retirer
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
                  <span className="text-muted">Cette part couvre</span>
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
                      + {fmt(unassignedMinor)} restant
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
            {multiPart
              ? "+ Ajouter une part"
              : "+ Répartir une partie différemment"}
          </button>
          {multiPart && (
            <span className={coverageValid ? "text-muted" : "text-neg"}>
              {assignedMinor === totalMinor
                ? `${fmt(totalMinor)} entièrement réparti`
                : assignedMinor > totalMinor
                  ? `${fmt(assignedMinor - totalMinor)} au-dessus du total`
                  : `${fmt(unassignedMinor)} sur ${fmt(totalMinor)} encore à répartir`}
            </span>
          )}
        </div>
      </fieldset>
      )}

      <div className="flex gap-3">
        <SubmitButton
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50"
          disabled={!canSubmit}
          pendingText={isEdit ? "Enregistrement…" : "Ajout…"}
        >
          {isEdit ? "Enregistrer" : "Ajouter la dépense"}
        </SubmitButton>
        <Link
          href={
            isEdit
              ? `/groups/${groupId}/expenses/${expenseId}`
              : `/groups/${groupId}`
          }
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
