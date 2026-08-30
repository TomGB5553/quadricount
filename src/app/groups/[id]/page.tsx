import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { computeGroupBalances, settleUp } from "@/lib/balances";
import { addMember } from "../actions";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ member?: string }>;
}) {
  const { id } = await params;
  const { member: filterMember } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, default_currency")
    .eq("id", id)
    .maybeSingle();

  // RLS returns nothing if the user isn't a member — treat as not found.
  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("id, display_name, role, status, user_id")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  const isOwner = members?.some(
    (m) => m.user_id === user.id && m.role === "owner" && m.status === "active",
  );

  const myMemberId = members?.find((m) => m.user_id === user.id)?.id;
  const nameOf = (memberId: string) =>
    members?.find((m) => m.id === memberId)?.display_name ?? "Someone";

  const { data: expenses } = await supabase
    .from("expenses")
    .select(
      "id, description, total_amount, currency, spent_at, " +
        "expense_payers(member_id, amount), " +
        "expense_allocations(member_id, amount)",
    )
    .eq("group_id", id)
    .order("spent_at", { ascending: false })
    .order("created_at", { ascending: false });

  // Feature 4 — impact at a glance: my net on an expense = what I paid minus
  // my share. Positive => I'm owed; negative => I owe; null => not involved.
  function myImpact(e: NonNullable<typeof expenses>[number]): number | null {
    if (!myMemberId) return null;
    const paid = e.expense_payers
      .filter((p) => p.member_id === myMemberId)
      .reduce((s, p) => s + p.amount, 0);
    const share = e.expense_allocations
      .filter((a) => a.member_id === myMemberId)
      .reduce((s, a) => s + a.amount, 0);
    if (paid === 0 && share === 0) return null;
    return paid - share;
  }

  // Feature 7 — filter the expense list to one person (payer or participant).
  const involves = (
    e: NonNullable<typeof expenses>[number],
    memberId: string,
  ) =>
    e.expense_payers.some((p) => p.member_id === memberId) ||
    e.expense_allocations.some((a) => a.member_id === memberId);

  const visibleExpenses =
    filterMember && expenses
      ? expenses.filter((e) => involves(e, filterMember))
      : (expenses ?? []);

  // Feature 6 — group balances, per currency (always the whole group).
  const balancesByCurrency = computeGroupBalances(expenses ?? []);
  const activeMembers = (members ?? []).filter((m) => m.status === "active");
  const inactiveMembers = (members ?? []).filter((m) => m.status === "inactive");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 p-6">
      <div>
        <Link href="/groups" className="text-sm text-gray-500 hover:underline">
          ← All groups
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{group.name}</h1>
        {group.description && (
          <p className="text-gray-500">{group.description}</p>
        )}
      </div>

      {balancesByCurrency.size > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Balances</h2>
          {[...balancesByCurrency.entries()].map(([currency, bal]) => {
            const inactiveWithBalance = inactiveMembers.filter(
              (m) => (bal.get(m.id) ?? 0) !== 0,
            );
            const inactiveSettled = inactiveMembers.filter(
              (m) => (bal.get(m.id) ?? 0) === 0,
            );
            // Active first, then removed members who still owe/are owed,
            // then removed members who are settled (dropped to the bottom).
            const ordered = [
              ...activeMembers,
              ...inactiveWithBalance,
              ...inactiveSettled,
            ];
            const transfers = settleUp(bal);

            return (
              <div key={currency} className="flex flex-col gap-2">
                {balancesByCurrency.size > 1 && (
                  <h3 className="text-sm font-medium text-gray-500">
                    {currency}
                  </h3>
                )}
                <ul className="flex flex-col gap-1">
                  {ordered.map((m) => {
                    const net = bal.get(m.id) ?? 0;
                    return (
                      <li
                        key={m.id}
                        className={`flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm ${
                          m.status === "inactive" ? "opacity-50" : ""
                        }`}
                      >
                        <span>
                          {m.display_name}
                          {m.status === "inactive" && (
                            <span className="ml-2 text-xs">inactive</span>
                          )}
                        </span>
                        <span
                          className={
                            net > 0
                              ? "text-green-700"
                              : net < 0
                                ? "text-red-700"
                                : "text-gray-400"
                          }
                        >
                          {net > 0
                            ? `gets back ${formatMoney(net, currency)}`
                            : net < 0
                              ? `owes ${formatMoney(-net, currency)}`
                              : "settled"}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {transfers.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium text-gray-500">
                      Who pays whom
                    </h3>
                    <ul className="flex flex-col gap-1 text-sm">
                      {transfers.map((t, idx) => (
                        <li key={idx}>
                          {nameOf(t.from)} → {nameOf(t.to)}{" "}
                          <span className="font-medium">
                            {formatMoney(t.amount, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Expenses</h2>
          <Link
            href={`/groups/${group.id}/expenses/new`}
            className="rounded bg-black px-3 py-1.5 text-sm text-white"
          >
            Add expense
          </Link>
        </div>

        {(members?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            <Link
              href={`/groups/${group.id}`}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                filterMember
                  ? "border-gray-300 text-gray-500"
                  : "border-black bg-black text-white"
              }`}
            >
              Everyone
            </Link>
            {members?.map((m) => (
              <Link
                key={m.id}
                href={`/groups/${group.id}?member=${m.id}`}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  filterMember === m.id
                    ? "border-black bg-black text-white"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                {m.display_name}
              </Link>
            ))}
          </div>
        )}

        <ul className="flex flex-col gap-1">
          {visibleExpenses.length > 0 ? (
            visibleExpenses.map((e) => {
              const impact = myImpact(e);
              const paidBy = e.expense_payers
                .map((p) => nameOf(p.member_id))
                .join(", ");
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
                >
                  <div className="text-sm">
                    <div className="font-medium">{e.description}</div>
                    <div className="text-xs text-gray-500">
                      {formatMoney(e.total_amount, e.currency)} · paid by{" "}
                      {paidBy} · {e.spent_at}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${
                      impact === null
                        ? "bg-gray-100 text-gray-400"
                        : impact > 0
                          ? "bg-green-100 text-green-700"
                          : impact < 0
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {impact === null
                      ? "not involved"
                      : impact > 0
                        ? `you're owed ${formatMoney(impact, e.currency)}`
                        : impact < 0
                          ? `you owe ${formatMoney(-impact, e.currency)}`
                          : "settled"}
                  </span>
                </li>
              );
            })
          ) : (
            <li className="text-sm text-gray-500">
              {filterMember
                ? `No expenses involving ${nameOf(filterMember)}.`
                : "No expenses yet."}
            </li>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Members</h2>
        <ul className="flex flex-col gap-1">
          {members?.map((m) => (
            <li
              key={m.id}
              className={`flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm ${
                m.status === "inactive" ? "text-gray-400" : ""
              }`}
            >
              <span>{m.display_name}</span>
              {m.role === "owner" && (
                <span className="text-xs text-gray-500">owner</span>
              )}
              {!m.user_id && m.status === "active" && (
                <span className="text-xs text-gray-400">not joined</span>
              )}
              {m.status === "inactive" && (
                <span className="text-xs">inactive</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <form action={addMember} className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Add a member</h2>
          <input type="hidden" name="groupId" value={group.id} />
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              name="name"
              required
              maxLength={100}
              placeholder="Marc"
              className="rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <button className="rounded bg-black px-3 py-2 text-white">
            Add member
          </button>
        </form>
      )}
    </main>
  );
}
