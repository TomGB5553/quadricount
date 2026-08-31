import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { computeGroupBalances, settleUp } from "@/lib/balances";
import SubmitButton from "@/components/SubmitButton";
import { addMember, setMemberStatus } from "../actions";

type Tab = "expenses" | "balances" | "members";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ member?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const filterMember = sp.member;
  const tab: Tab =
    sp.tab === "balances" || sp.tab === "members" ? sp.tab : "expenses";
  const user = await requireUser();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, default_currency")
    .eq("id", id)
    .maybeSingle();
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
      "id, description, total_amount, currency, fx_rate_to_group_currency, spent_at, expense_payers(member_id, amount), expense_allocations(member_id, amount)",
    )
    .eq("group_id", id)
    .order("spent_at", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: settlements } = await supabase
    .from("settlements")
    .select(
      "id, from_member, to_member, amount, currency, fx_rate_to_group_currency, settled_at, note",
    )
    .eq("group_id", id)
    .order("settled_at", { ascending: false })
    .order("created_at", { ascending: false });

  // my net on an expense = what I paid minus my share
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

  const involves = (e: NonNullable<typeof expenses>[number], memberId: string) =>
    e.expense_payers.some((p) => p.member_id === memberId) ||
    e.expense_allocations.some((a) => a.member_id === memberId);

  const visibleExpenses =
    filterMember && expenses
      ? expenses.filter((e) => involves(e, filterMember))
      : (expenses ?? []);

  const gc = group.default_currency;
  const { net: balances, currencies } = computeGroupBalances(
    expenses ?? [],
    settlements ?? [],
  );
  const hasConversions = currencies.some((c) => c !== gc);
  const activeMembers = (members ?? []).filter((m) => m.status === "active");
  const inactiveMembers = (members ?? []).filter((m) => m.status === "inactive");
  const orderedForBalances = [
    ...activeMembers,
    ...inactiveMembers.filter((m) => (balances.get(m.id) ?? 0) !== 0),
    ...inactiveMembers.filter((m) => (balances.get(m.id) ?? 0) === 0),
  ];
  const transfers = settleUp(balances);
  const myNet = myMemberId ? (balances.get(myMemberId) ?? 0) : null;

  const card = "rounded-2xl border border-line bg-surface";
  const row =
    "flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-3 text-sm";

  const TabLink = ({ value, label }: { value: Tab; label: string }) => (
    <Link
      href={`/groups/${id}?tab=${value}`}
      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
        tab === value
          ? "bg-surface font-semibold text-ink shadow-sm"
          : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <Link href="/groups" className="text-sm text-muted hover:underline">
          ← All groups
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {group.name}
          </h1>
          {isOwner && (
            <Link
              href={`/groups/${group.id}/edit`}
              className="text-sm text-muted underline hover:text-ink"
            >
              Edit
            </Link>
          )}
        </div>
        {group.description && (
          <p className="text-sm text-muted">{group.description}</p>
        )}
      </div>

      {/* your balance hero */}
      <div className={`${card} flex flex-col gap-1 p-4`}>
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Your balance in this group
        </span>
        <span
          className={`text-2xl font-extrabold ${
            myNet && myNet > 0
              ? "text-pos"
              : myNet && myNet < 0
                ? "text-neg"
                : "text-muted"
          }`}
        >
          {myNet && myNet > 0
            ? `You're owed ${formatMoney(myNet, gc)}`
            : myNet && myNet < 0
              ? `You owe ${formatMoney(-myNet, gc)}`
              : "You're settled up"}
        </span>
      </div>

      {/* actions */}
      <div className="flex gap-2">
        <Link
          href={`/groups/${group.id}/expenses/new`}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-ink hover:bg-primary-hover"
        >
          Add expense
        </Link>
        <Link
          href={`/groups/${group.id}/settle/new`}
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-center text-sm font-semibold hover:bg-surface-2"
        >
          Record payment
        </Link>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        <TabLink value="expenses" label="Expenses" />
        <TabLink value="balances" label="Balances" />
        <TabLink value="members" label="Members" />
      </div>

      {/* ---------- EXPENSES ---------- */}
      {tab === "expenses" && (
        <section className="flex flex-col gap-3">
          {(members?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={`/groups/${group.id}?tab=expenses`}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  filterMember
                    ? "border-line text-muted"
                    : "border-primary bg-primary text-primary-ink"
                }`}
              >
                Everyone
              </Link>
              {members?.map((m) => (
                <Link
                  key={m.id}
                  href={`/groups/${group.id}?tab=expenses&member=${m.id}`}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    filterMember === m.id
                      ? "border-primary bg-primary text-primary-ink"
                      : "border-line text-muted"
                  }`}
                >
                  {m.display_name}
                </Link>
              ))}
            </div>
          )}

          <ul className="flex flex-col gap-1.5">
            {visibleExpenses.length > 0 ? (
              visibleExpenses.map((e) => {
                const impact = myImpact(e);
                const paidBy = e.expense_payers
                  .map((p) => nameOf(p.member_id))
                  .join(", ");
                return (
                  <li key={e.id}>
                    <Link
                      href={`/groups/${group.id}/expenses/${e.id}`}
                      className={`${row} hover:bg-surface-2`}
                    >
                      <div>
                        <div className="font-semibold">{e.description}</div>
                        <div className="text-xs text-muted">
                          {formatMoney(e.total_amount, e.currency)}
                          {e.currency !== gc &&
                            ` (≈ ${formatMoney(
                              Math.round(
                                e.total_amount *
                                  (e.fx_rate_to_group_currency || 1),
                              ),
                              gc,
                            )})`}{" "}
                          · {paidBy} · {e.spent_at}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${
                          impact === null || impact === 0
                            ? "bg-surface-2 text-muted"
                            : impact > 0
                              ? "bg-pos-bg text-pos"
                              : "bg-neg-bg text-neg"
                        }`}
                      >
                        {impact === null
                          ? "not involved"
                          : impact > 0
                            ? `+${formatMoney(impact, e.currency)}`
                            : impact < 0
                              ? `−${formatMoney(-impact, e.currency)}`
                              : "settled"}
                      </span>
                    </Link>
                  </li>
                );
              })
            ) : (
              <li className="rounded-xl border border-dashed border-line px-3.5 py-6 text-center text-sm text-muted">
                {filterMember
                  ? `No expenses involving ${nameOf(filterMember)}.`
                  : "No expenses yet — add the first one."}
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ---------- BALANCES ---------- */}
      {tab === "balances" && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            {orderedForBalances.map((m) => {
              const net = balances.get(m.id) ?? 0;
              return (
                <div
                  key={m.id}
                  className={`${row} ${m.status === "inactive" ? "opacity-50" : ""}`}
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
                        ? "font-semibold text-pos"
                        : net < 0
                          ? "font-semibold text-neg"
                          : "text-muted"
                    }
                  >
                    {net > 0
                      ? `gets back ${formatMoney(net, gc)}`
                      : net < 0
                        ? `owes ${formatMoney(-net, gc)}`
                        : "settled"}
                  </span>
                </div>
              );
            })}
          </div>

          {transfers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-muted">Who pays whom</h3>
              {transfers.map((t, idx) => (
                <Link
                  key={idx}
                  href={`/groups/${group.id}/settle/new?from=${t.from}&to=${t.to}&amount=${(
                    t.amount / 100
                  ).toFixed(2)}`}
                  className={`${row} hover:bg-surface-2`}
                >
                  <span>
                    {nameOf(t.from)} → {nameOf(t.to)}
                  </span>
                  <span className="font-semibold">
                    {formatMoney(t.amount, gc)}
                  </span>
                </Link>
              ))}
              <Link
                href={`/groups/${group.id}/transfer/new`}
                className="mt-1 text-xs text-muted underline"
              >
                Move a balance to another group
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold text-muted">Payments</h3>
            {settlements && settlements.length > 0 ? (
              settlements.map((s) => (
                <div key={s.id} className={row}>
                  <span>
                    {nameOf(s.from_member)} → {nameOf(s.to_member)}
                    {s.note && (
                      <span className="text-xs text-muted"> · {s.note}</span>
                    )}
                  </span>
                  <span className="text-muted">
                    {formatMoney(s.amount, s.currency)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No payments recorded yet.</p>
            )}
          </div>

          {hasConversions && (
            <p className="text-xs text-muted">
              Amounts in other currencies converted to {gc} at each
              transaction&apos;s rate on its date.
            </p>
          )}
        </section>
      )}

      {/* ---------- MEMBERS ---------- */}
      {tab === "members" && (
        <section className="flex flex-col gap-3">
          {isOwner && (
            <Link
              href={`/groups/${group.id}/invite`}
              className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink hover:bg-primary-hover"
            >
              + Invite someone
            </Link>
          )}
          <div className="flex flex-col gap-1.5">
            {members?.map((m) => (
              <div
                key={m.id}
                className={`${row} ${m.status === "inactive" ? "opacity-50" : ""}`}
              >
                <span className="flex-1 font-medium">{m.display_name}</span>
                <div className="flex items-center gap-3 text-xs">
                  {m.role === "owner" && (
                    <span className="text-muted">owner</span>
                  )}
                  {!m.user_id && m.status === "active" && (
                    <span className="text-muted">not joined</span>
                  )}
                  {m.status === "inactive" && (
                    <span className="text-muted">inactive</span>
                  )}
                  {isOwner && !m.user_id && m.status === "active" && (
                    <Link
                      href={`/groups/${group.id}/members/${m.id}/invite`}
                      className="font-semibold text-primary hover:underline"
                    >
                      Invite
                    </Link>
                  )}
                  {isOwner && m.role !== "owner" && (
                    <form action={setMemberStatus}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="memberId" value={m.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={m.status === "active" ? "inactive" : "active"}
                      />
                      <SubmitButton
                        className="text-muted hover:text-ink disabled:opacity-50"
                        pendingText="…"
                      >
                        {m.status === "active" ? "Remove" : "Re-activate"}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isOwner && (
            <form
              action={addMember}
              className="mt-2 flex flex-col gap-2 border-t border-line pt-4"
            >
              <h3 className="text-sm font-semibold">Add a placeholder member</h3>
              <input type="hidden" name="groupId" value={group.id} />
              <input
                name="name"
                required
                maxLength={100}
                placeholder="Name"
                className="rounded-xl border border-line bg-surface px-3 py-2"
              />
              <SubmitButton pendingText="Adding…">Add member</SubmitButton>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
