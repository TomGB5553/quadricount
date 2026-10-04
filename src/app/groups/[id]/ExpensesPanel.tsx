"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { PaidSplitAvatars } from "@/components/Avatar";
import { useT, useLocale } from "@/lib/i18n/client";

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
  const locale = useLocale();
  const [filter, setFilter] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // close the "Others" menu on outside tap or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
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

  // group the (already date-sorted) list under one header per day
  const byDate: { date: string; items: Expense[] }[] = [];
  for (const e of visible) {
    const last = byDate[byDate.length - 1];
    if (last && last.date === e.spent_at) last.items.push(e);
    else byDate.push({ date: e.spent_at, items: [e] });
  }

  // show the current user's own chip first, right after "Everyone"
  const orderedMembers = myMemberId
    ? [
        ...members.filter((m) => m.id === myMemberId),
        ...members.filter((m) => m.id !== myMemberId),
      ]
    : members;

  const meMember = orderedMembers.find((m) => m.id === myMemberId);
  const others = orderedMembers.filter((m) => m.id !== myMemberId);
  const othersActive = !!filter && filter !== myMemberId;

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs ${
      active
        ? "border-primary bg-primary text-primary-ink"
        : "border-line text-muted"
    }`;

  return (
    <section className="flex flex-col gap-3">
      {members.length > 0 && (
        <div className="relative flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={chip(!filter)}
          >
            {t("exp.filterEveryone")}
          </button>
          {meMember && (
            <button
              type="button"
              onClick={() => setFilter(meMember.id)}
              className={chip(filter === meMember.id)}
            >
              {t("exp.filterYou")}
            </button>
          )}
          {others.length > 0 && (
            <div ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                className={`${chip(othersActive)} flex items-center gap-1`}
              >
                {othersActive && filter ? nameOf(filter) : t("exp.filterOthers")}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {menuOpen && (
                <ul className="absolute left-0 top-full z-30 mt-1.5 max-h-64 w-56 max-w-full overflow-auto rounded-xl bg-surface p-1 shadow-lg ring-1 ring-line">
                  {others.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setFilter(m.id);
                          setMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 ${
                          filter === m.id ? "font-bold text-primary" : ""
                        }`}
                      >
                        {m.display_name}
                        {filter === m.id && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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

      {visible.length > 0 ? (
        <div className="flex flex-col gap-4">
          {byDate.map(({ date, items }) => (
            <div key={date} className="flex flex-col gap-1.5">
              <h3 className="px-1 pt-1 text-sm font-semibold text-muted">
                {formatDate(date, locale)}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {items.map((e) => {
                  const payerNames = e.expense_payers.map((p) =>
                    nameOf(p.member_id),
                  );
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
                        className={`flex items-center justify-between gap-3 rounded-lg bg-surface px-3.5 py-2.5 shadow-sm ring-1 ring-line/60 hover:bg-surface-2 ${edge}`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {e.description}
                          </div>
                          <div className="mt-1">
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
                                  amount: formatMoney(
                                    e.total_amount,
                                    e.currency,
                                  ),
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
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line px-3.5 py-6 text-center text-sm text-muted">
          {filter
            ? t("exp.noneInvolving", { name: nameOf(filter) })
            : t("exp.noneYet")}
        </div>
      )}
    </section>
  );
}
