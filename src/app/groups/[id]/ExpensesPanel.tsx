"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { AvatarStack } from "@/components/Avatar";

type Member = { id: string; display_name: string };
type Expense = {
  id: string;
  description: string;
  total_amount: number;
  currency: string;
  fx_rate_to_group_currency: number;
  spent_at: string;
  expense_payers: { member_id: string; amount: number }[];
  expense_allocations: { member_id: string; amount: number }[];
};

export default function ExpensesPanel({
  groupId,
  groupCurrency,
  members,
  expenses,
  myMemberId,
}: {
  groupId: string;
  groupCurrency: string;
  members: Member[];
  expenses: Expense[];
  myMemberId: string | null;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.display_name ?? "Someone";

  const involves = (e: Expense, id: string) =>
    e.expense_payers.some((p) => p.member_id === id) ||
    e.expense_allocations.some((a) => a.member_id === id);

  const visible = filter ? expenses.filter((e) => involves(e, filter)) : expenses;

  const impactOf = (e: Expense): number | null => {
    if (!myMemberId) return null;
    const paid = e.expense_payers
      .filter((p) => p.member_id === myMemberId)
      .reduce((s, p) => s + p.amount, 0);
    const share = e.expense_allocations
      .filter((a) => a.member_id === myMemberId)
      .reduce((s, a) => s + a.amount, 0);
    if (paid === 0 && share === 0) return null;
    return paid - share;
  };

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs ${
      active
        ? "border-primary bg-primary text-primary-ink"
        : "border-line text-muted"
    }`;

  return (
    <section className="flex flex-col gap-3">
      {members.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={chip(!filter)}
          >
            Everyone
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setFilter(m.id)}
              className={chip(filter === m.id)}
            >
              {m.display_name}
            </button>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {visible.length > 0 ? (
          visible.map((e) => {
            const impact = impactOf(e);
            const payerIds = new Set(e.expense_payers.map((p) => p.member_id));
            // everyone involved: payers first, then other participants
            const involvedIds = [
              ...e.expense_payers.map((p) => p.member_id),
              ...e.expense_allocations
                .map((a) => a.member_id)
                .filter((mid) => !payerIds.has(mid)),
            ];
            const people = involvedIds.map((mid) => ({
              name: nameOf(mid),
              ring: payerIds.has(mid),
            }));
            return (
              <li key={e.id}>
                <Link
                  href={`/groups/${groupId}/expenses/${e.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {e.description}
                    </div>
                    <div className="text-xs text-muted">
                      {formatMoney(e.total_amount, e.currency)}
                      {e.currency !== groupCurrency &&
                        ` (≈ ${formatMoney(
                          Math.round(
                            e.total_amount * (e.fx_rate_to_group_currency || 1),
                          ),
                          groupCurrency,
                        )})`}{" "}
                      · {e.spent_at}
                    </div>
                    <div className="mt-1.5">
                      <AvatarStack people={people} />
                    </div>
                  </div>
                  {impact === null ? (
                    <span className="shrink-0 text-xs text-muted">
                      not involved
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${
                        impact === 0
                          ? "bg-surface-2 text-muted"
                          : impact > 0
                            ? "bg-pos-bg text-pos"
                            : "bg-neg-bg text-neg"
                      }`}
                    >
                      {impact > 0
                        ? `+${formatMoney(impact, e.currency)}`
                        : impact < 0
                          ? `−${formatMoney(-impact, e.currency)}`
                          : "settled"}
                    </span>
                  )}
                </Link>
              </li>
            );
          })
        ) : (
          <li className="rounded-xl border border-dashed border-line px-3.5 py-6 text-center text-sm text-muted">
            {filter
              ? `No expenses involving ${nameOf(filter)}.`
              : "No expenses yet — add the first one."}
          </li>
        )}
      </ul>
    </section>
  );
}
