import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { computeGroupBalances, settleUp } from "@/lib/balances";
import { suggestNextPayer } from "@/lib/next-payer";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import Avatar from "@/components/Avatar";
import GroupTabs from "./GroupTabs";
import ExpensesPanel from "./ExpensesPanel";
import {
  addMember,
  deleteSettlement,
  setMemberStatus,
  updateMyGroupName,
} from "../actions";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const t = await getT();

  const [{ data: group }, { data: members }, { data: expenses }, { data: settlements }] =
    await Promise.all([
      supabase
        .from("groups")
        .select("id, name, description, default_currency")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("id, display_name, role, status, user_id")
        .eq("group_id", id)
        .order("joined_at", { ascending: true }),
      supabase
        .from("expenses")
        .select(
          "id, description, total_amount, currency, fx_rate_to_group_currency, spent_at, expense_payers(member_id, amount), expense_allocations(member_id, amount)",
        )
        .eq("group_id", id)
        .order("spent_at", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("settlements")
        .select(
          "id, from_member, to_member, amount, currency, fx_rate_to_group_currency, settled_at, note, source, created_by",
        )
        .eq("group_id", id)
        .order("settled_at", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  if (!group) notFound();

  const isOwner = members?.some(
    (m) => m.user_id === user.id && m.role === "owner" && m.status === "active",
  );
  const myMember = members?.find((m) => m.user_id === user.id) ?? null;
  const myMemberId = myMember?.id ?? null;
  const nameOf = (memberId: string) =>
    members?.find((m) => m.id === memberId)?.display_name ?? t("common.somebody");

  const gc = group.default_currency;
  const { net: balances, currencies } = computeGroupBalances(
    expenses ?? [],
    settlements ?? [],
  );
  const hasConversions = currencies.some((c) => c !== gc);
  const byNetDesc = (a: { id: string }, b: { id: string }) =>
    (balances.get(b.id) ?? 0) - (balances.get(a.id) ?? 0);
  const activeMembers = (members ?? []).filter((m) => m.status === "active");
  const inactiveMembers = (members ?? []).filter((m) => m.status === "inactive");
  const orderedForBalances = [
    ...[...activeMembers].sort(byNetDesc),
    ...inactiveMembers
      .filter((m) => (balances.get(m.id) ?? 0) !== 0)
      .sort(byNetDesc),
    ...inactiveMembers.filter((m) => (balances.get(m.id) ?? 0) === 0),
  ];
  const transfers = settleUp(balances);
  const mine = transfers.filter(
    (tr) => tr.from === myMemberId || tr.to === myMemberId,
  );
  const others = transfers.filter(
    (tr) => tr.from !== myMemberId && tr.to !== myMemberId,
  );
  const myNet = myMemberId ? (balances.get(myMemberId) ?? 0) : null;

  // "Whose turn to pay?" — see suggestNextPayer for the heuristics.
  const nextPayerHit = suggestNextPayer({
    members: activeMembers,
    netByMember: balances,
    expenseAmounts: (expenses ?? []).map((e) =>
      Math.round(e.total_amount * (e.fx_rate_to_group_currency || 1)),
    ),
  });
  const nextPayers = nextPayerHit
    ? nextPayerHit.memberIds
        .map((mid) => activeMembers.find((m) => m.id === mid))
        .filter((m): m is (typeof activeMembers)[number] => !!m)
    : [];

  function nextPayerMessage(): string | null {
    if (nextPayers.length === 1) {
      const m = nextPayers[0];
      const amount = formatMoney(-(balances.get(m.id) ?? 0), gc);
      return m.id === myMemberId
        ? t("bal.nextPayerYou", { amount })
        : t("bal.nextPayerOther", { name: m.display_name, amount });
    }
    if (nextPayers.length === 2) {
      const mine = nextPayers.find((m) => m.id === myMemberId);
      if (mine) {
        const other = nextPayers.find((m) => m.id !== myMemberId)!;
        return t("bal.nextPayerYouAnd", { name: other.display_name });
      }
      return t("bal.nextPayerPair", {
        a: nextPayers[0].display_name,
        b: nextPayers[1].display_name,
      });
    }
    return null;
  }
  const nextPayerText = nextPayerMessage();

  const card = "rounded-2xl border border-line bg-surface";
  const row =
    "flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-3 text-sm";

  const settleHref = (tr: { from: string; to: string; amount: number }) =>
    `/groups/${group.id}/settle/new?from=${tr.from}&to=${tr.to}&amount=${(
      tr.amount / 100
    ).toFixed(2)}`;

  /* ---------- BALANCES PANEL (server-rendered) ---------- */
  const balancesPanel = (
    <section key="balances" className="flex flex-col gap-5">
      {nextPayerText && (
        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-muted">
          <span aria-hidden>💡</span>
          <p>{nextPayerText}</p>
        </div>
      )}

      {mine.length > 0 && (
        <div className="flex flex-col gap-2">
          {mine.map((tr, i) => {
            const iOwe = tr.from === myMemberId;
            const other = nameOf(iOwe ? tr.to : tr.from);
            return (
              <Link
                key={i}
                href={settleHref(tr)}
                className={`${card} flex items-center gap-3 p-4 hover:bg-surface-2`}
              >
                <Avatar name={other} size={40} />
                <div className="flex-1">
                  <div className="text-sm text-muted">
                    {iOwe ? t("bal.iOwe") : t("bal.owesYou", { name: other })}
                  </div>
                  <div
                    className={`text-lg font-extrabold ${iOwe ? "text-neg" : "text-pos"}`}
                  >
                    {formatMoney(tr.amount, gc)}
                    {iOwe && (
                      <span className="text-sm font-semibold text-ink">
                        {" "}
                        {t("bal.to", { name: other })}
                      </span>
                    )}
                  </div>
                </div>
                <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-ink">
                  {t("bal.settleUp")}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-muted">{t("bal.everyone")}</h3>
        {orderedForBalances.map((m) => {
          const net = balances.get(m.id) ?? 0;
          return (
            <div
              key={m.id}
              className={`${row} ${m.status === "inactive" ? "opacity-50" : ""}`}
            >
              <span className="flex items-center gap-2.5">
                <Avatar name={m.display_name} />
                {m.display_name}
                {m.status === "inactive" && (
                  <span className="text-xs">{t("bal.inactive")}</span>
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
                  ? t("bal.getsBack", { amount: formatMoney(net, gc) })
                  : net < 0
                    ? t("bal.owes", { amount: formatMoney(-net, gc) })
                    : t("bal.settled")}
              </span>
            </div>
          );
        })}
      </div>

      {others.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-muted">
            {t("bal.betweenOthers")}
          </h3>
          {others.map((tr, i) => (
            <Link
              key={i}
              href={settleHref(tr)}
              className={`${row} hover:bg-surface-2`}
            >
              <span className="flex items-center gap-2">
                <Avatar name={nameOf(tr.from)} size={22} />
                <span className="font-medium">{nameOf(tr.from)}</span>
                <span className="text-muted">{t("bal.owesWord")}</span>
                <span className="font-semibold">
                  {formatMoney(tr.amount, gc)}
                </span>
                <span className="text-muted">{t("bal.toWord")}</span>
                <Avatar name={nameOf(tr.to)} size={22} />
                <span className="font-medium">{nameOf(tr.to)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {transfers.length > 0 && (
        <Link
          href={`/groups/${group.id}/transfer/new`}
          className="text-xs text-muted underline"
        >
          {t("bal.moveToGroup")}
        </Link>
      )}

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-muted">{t("bal.payments")}</h3>
        {settlements && settlements.length > 0 ? (
          settlements.map((s) => {
            const canDelete =
              s.source === "manual_payment" &&
              (s.created_by === user.id || isOwner);
            return (
              <div key={s.id} className={row}>
                <span className="flex items-center gap-2">
                  <Avatar name={nameOf(s.from_member)} size={22} />
                  {nameOf(s.from_member)}
                  <span className="text-muted">{t("bal.paidWord")}</span>
                  <Avatar name={nameOf(s.to_member)} size={22} />
                  {nameOf(s.to_member)}
                  {s.note && (
                    <span className="text-xs text-muted"> · {s.note}</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted">
                    {formatMoney(s.amount, s.currency)}
                  </span>
                  {canDelete && (
                    <form action={deleteSettlement}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input
                        type="hidden"
                        name="settlementId"
                        value={s.id}
                      />
                      <ConfirmSubmit
                        confirm={t("bal.deletePaymentConfirm", {
                          amount: formatMoney(s.amount, s.currency),
                        })}
                      >
                        {t("common.delete")}
                      </ConfirmSubmit>
                    </form>
                  )}
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted">{t("bal.noPayments")}</p>
        )}
      </div>

      {hasConversions && (
        <p className="text-xs text-muted">
          {t("bal.fxNote", { currency: gc })}
        </p>
      )}
    </section>
  );

  /* ---------- MEMBERS PANEL (server-rendered) ---------- */
  const membersPanel = (
    <section key="members" className="flex flex-col gap-3">
      {myMember && (
        <form
          action={updateMyGroupName}
          className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4"
        >
          <input type="hidden" name="groupId" value={group.id} />
          <label className="text-sm font-semibold">
            {t("members.yourName")}
          </label>
          <div className="flex gap-2">
            <input
              name="displayName"
              required
              maxLength={100}
              defaultValue={myMember.display_name}
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm"
            />
            <SubmitButton
              className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
              pendingText="…"
            >
              {t("common.save")}
            </SubmitButton>
          </div>
          <p className="text-xs text-muted">{t("members.yourNameHint")}</p>
        </form>
      )}

      <Link
        href={`/groups/${group.id}/invite`}
        className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink hover:bg-primary-hover"
      >
        {t("members.invite")}
      </Link>
      <div className="flex flex-col gap-1.5">
        {members?.map((m) => (
          <div
            key={m.id}
            className={`${row} ${m.status === "inactive" ? "opacity-50" : ""}`}
          >
            <span className="flex flex-1 items-center gap-2.5 font-medium">
              <Avatar name={m.display_name} />
              {m.display_name}
            </span>
            <div className="flex items-center gap-3 text-xs">
              {m.role === "owner" && (
                <span className="text-muted">{t("members.owner")}</span>
              )}
              {!m.user_id && m.status === "active" && (
                <span className="text-muted">{t("members.notJoined")}</span>
              )}
              {m.status === "inactive" && (
                <span className="text-muted">{t("members.inactive")}</span>
              )}
              {!m.user_id && m.status === "active" && (
                <Link
                  href={`/groups/${group.id}/members/${m.id}/invite`}
                  className="font-semibold text-primary hover:underline"
                >
                  {t("members.inviteWord")}
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
                    {m.status === "active"
                      ? t("common.remove")
                      : t("members.reactivate")}
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        action={addMember}
        className="mt-2 flex flex-col gap-2 border-t border-line pt-4"
      >
        <h3 className="text-sm font-semibold">{t("members.addPlaceholder")}</h3>
        <p className="text-xs text-muted">{t("members.addPlaceholderHint")}</p>
        <input type="hidden" name="groupId" value={group.id} />
        <input
          name="name"
          required
          maxLength={100}
          placeholder={t("members.namePlaceholder")}
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        />
        <SubmitButton pendingText={t("common.adding")}>
          {t("members.addMember")}
        </SubmitButton>
      </form>
    </section>
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <Link href="/groups" className="text-sm text-muted hover:underline">
          {t("group.backAll")}
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
              {t("common.edit")}
            </Link>
          )}
        </div>
        {group.description && (
          <p className="text-sm text-muted">{group.description}</p>
        )}
      </div>

      <div className={`${card} flex flex-col gap-1 p-4`}>
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {t("group.yourBalance")}
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
            ? t("group.youreOwed", { amount: formatMoney(myNet, gc) })
            : myNet && myNet < 0
              ? t("group.youOwe", { amount: formatMoney(-myNet, gc) })
              : t("group.settledUp")}
        </span>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/groups/${group.id}/expenses/new`}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-ink hover:bg-primary-hover"
        >
          {t("group.addExpense")}
        </Link>
        <Link
          href={`/groups/${group.id}/settle/new`}
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-center text-sm font-semibold hover:bg-surface-2"
        >
          {t("group.recordPayment")}
        </Link>
      </div>

      <GroupTabs
        labels={[
          t("group.tabExpenses"),
          t("group.tabBalances"),
          t("group.tabMembers"),
        ]}
        panels={[
          <ExpensesPanel
            key="expenses"
            groupId={group.id}
            groupCurrency={gc}
            members={(members ?? []).map((m) => ({
              id: m.id,
              display_name: m.display_name,
            }))}
            expenses={expenses ?? []}
            myMemberId={myMemberId}
          />,
          balancesPanel,
          membersPanel,
        ]}
      />
    </main>
  );
}
