"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { PaidSplitAvatars } from "@/components/Avatar";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
  const [filter, setFilter] = useState<string | null>(null);
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.display_name ?? t("common.somebody");

  const paidBy = (e: Expense, id: string) =>
    e.expense_payers
      .filter((p) => p.member_id === id)
      .reduce((s, p) => s + p.amount, 0);
  const shareOf = (e: Expense, id: string) =>
    e.expense_allocations
      .filter((a) => a.member_id === id)
      .reduce((s, a) => s + a.amount, 0);

  // someone's net on an expense (what they paid minus their share); null if
  // they're not involved. Used for the colored left edge.
  const netOn = (e: Expense, id: string | null): number | null => {
    if (!id) return null;
    const paid = paidBy(e, id);
    const share = shareOf(e, id);
    if (paid === 0 && share === 0) return null;
    return paid - share;
  };

  const involves = (e: Expense, id: string) =>
    e.expense_payers.some((p) => p.member_id === id) ||
    e.expense_allocations.some((a) => a.member_id === id);

  const visible = filter ? expenses.filter((e) => involves(e, filter)) : expenses;

  // in the group currency, so a mixed-currency list still totals
  const inGroupCurrency = (e: Expense, minor: number) =>
    e.currency === groupCurrency
      ? minor
      : Math.round(minor * (e.fx_rate_to_group_currency || 1));

  const personSummary =
    filter && visible.length > 0
      ? visible.reduce(
          (acc, e) => ({
            share: acc.share + inGroupCurrency(e, shareOf(e, filter)),
            paid: acc.paid + inGroupCurrency(e, paidBy(e, filter)),
          }),
          { share: 0, paid: 0 },
        )
      : null;

  // show the current user's own chip first, right after "Everyone"
  const orderedMembers = myMemberId
    ? [
        ...members.filter((m) => m.id === myMemberId),
        ...members.filter((m) => m.id !== myMemberId),
      ]
    : members;

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
            {t("exp.filterEveryone")}
          </button>
          {orderedMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setFilter(m.id)}
              className={chip(filter === m.id)}
            >
              {m.id === myMemberId ? t("exp.filterYou") : m.display_name}
            </button>
          ))}
        </div>
      )}

      {personSummary && filter && (
        <p className="text-sm">
          <span className="font-semibold">
            {t("exp.personSummary", {
              name: nameOf(filter),
              share: formatMoney(personSummary.share, groupCurrency),
              count: visible.length,
            })}
          </span>
          {personSummary.paid > 0 && (
            <span className="text-muted">
              {" · "}
              {t("exp.personPaid", {
                amount: formatMoney(personSummary.paid, groupCurrency),
              })}
            </span>
          )}
        </p>
      )}

      <ul className="flex flex-col gap-2">
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
            // when a person is selected, show the list through their eyes
            const lens = filter;
            const net = netOn(e, lens ?? myMemberId);
            const edge =
              net && net > 0
                ? "border-l-4 border-l-pos"
                : net && net < 0
                  ? "border-l-4 border-l-neg"
                  : "";
            return (
              <li key={e.id}>
                <Link
                  href={`/groups/${groupId}/expenses/${e.id}`}
                  className={`flex items-center justify-between gap-3 rounded-lg bg-surface px-3.5 py-3 shadow-sm ring-1 ring-line/60 hover:bg-surface-2 ${edge}`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {e.description}
                    </div>
                    <div className="text-xs text-muted">
                      {formatDate(e.spent_at)}
                    </div>
                    <div className="mt-1.5">
                      <PaidSplitAvatars
                        payers={payerNames}
                        participants={splitNames}
                        paidLabel={t("exp.paidBy")}
                        forLabel={t("exp.for")}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {lens ? (
                      <>
                        <div className="font-bold">
                          {formatMoney(shareOf(e, lens), e.currency)}
                        </div>
                        <div className="text-xs text-muted">
                          {t("exp.of", {
                            amount: formatMoney(e.total_amount, e.currency),
                          })}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-bold">
                          {formatMoney(e.total_amount, e.currency)}
                        </div>
                        {converted && (
                          <div className="text-xs text-muted">
                            ≈ {converted}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              </li>
            );
          })
        ) : (
          <li className="rounded-xl border border-dashed border-line px-3.5 py-6 text-center text-sm text-muted">
            {filter
              ? t("exp.noneInvolving", { name: nameOf(filter) })
              : t("exp.noneYet")}
          </li>
        )}
      </ul>
    </section>
  );
}
