"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { PaidSplitAvatars } from "@/components/Avatar";

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
}: {
  groupId: string;
  groupCurrency: string;
  members: Member[];
  expenses: Expense[];
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.display_name ?? "Someone";

  const involves = (e: Expense, id: string) =>
    e.expense_payers.some((p) => p.member_id === id) ||
    e.expense_allocations.some((a) => a.member_id === id);

  const visible = filter ? expenses.filter((e) => involves(e, filter)) : expenses;

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
            const payerNames = e.expense_payers.map((p) => nameOf(p.member_id));
            const splitNames = e.expense_allocations.map((a) =>
              nameOf(a.member_id),
            );
            const converted =
              e.currency !== groupCurrency
                ? formatMoney(
                    Math.round(
                      e.total_amount * (e.fx_rate_to_group_currency || 1),
                    ),
                    groupCurrency,
                  )
                : null;
            return (
              <li key={e.id}>
                <Link
                  href={`/groups/${groupId}/expenses/${e.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {e.description}
                    </div>
                    <div className="text-xs text-muted">{e.spent_at}</div>
                    <div className="mt-1.5">
                      <PaidSplitAvatars
                        payers={payerNames}
                        participants={splitNames}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold">
                      {formatMoney(e.total_amount, e.currency)}
                    </div>
                    {converted && (
                      <div className="text-xs text-muted">≈ {converted}</div>
                    )}
                  </div>
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
