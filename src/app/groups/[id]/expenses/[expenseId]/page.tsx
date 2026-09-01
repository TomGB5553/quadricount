import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { EXPENSE_SELECT, type FullExpense } from "@/lib/expense";
import SubmitButton from "@/components/SubmitButton";
import Avatar from "@/components/Avatar";
import { deleteExpense } from "../../../actions";

const methodLabel: Record<string, string> = {
  equal: "split equally",
  exact: "exact amounts",
  percentage: "by percentage",
  shares: "by shares",
};

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select(EXPENSE_SELECT)
    .eq("id", expenseId)
    .maybeSingle<FullExpense>();
  if (!expense || expense.group_id !== id) notFound();

  const [{ data: group }, { data: members }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, default_currency")
      .eq("id", id)
      .single(),
    supabase
      .from("group_members")
      .select("id, display_name, user_id, role")
      .eq("group_id", id),
  ]);

  const nameOf = (memberId: string) =>
    members?.find((m) => m.id === memberId)?.display_name ?? "Someone";
  const canEdit =
    expense.created_by === user.id ||
    !!members?.some((m) => m.user_id === user.id && m.role === "owner");

  const cur = expense.currency;
  const gc = group?.default_currency ?? cur;
  const converted =
    cur !== gc
      ? formatMoney(
          Math.round(expense.total_amount * (expense.fx_rate_to_group_currency || 1)),
          gc,
        )
      : null;

  const myMemberId = members?.find((m) => m.user_id === user.id)?.id;
  const myPaid = expense.expense_payers
    .filter((p) => p.member_id === myMemberId)
    .reduce((s, p) => s + p.amount, 0);
  const myShare = expense.expense_allocations
    .filter((a) => a.member_id === myMemberId)
    .reduce((s, a) => s + a.amount, 0);
  const myNet = myPaid - myShare;
  const inIt = myPaid > 0 || myShare > 0;

  const components = [...expense.expense_split_components].sort(
    (a, b) => a.seq - b.seq,
  );
  const row =
    "flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <Link href={`/groups/${id}`} className="text-sm text-muted hover:underline">
          ← {group?.name}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {expense.description}
        </h1>

        {inIt ? (
          <>
            <p
              className={`text-2xl font-extrabold ${
                myNet > 0 ? "text-pos" : myNet < 0 ? "text-neg" : "text-muted"
              }`}
            >
              {myNet > 0
                ? `You're owed ${formatMoney(myNet, cur)}`
                : myNet < 0
                  ? `You owe ${formatMoney(-myNet, cur)}`
                  : "You're square on this one"}
            </p>
            <p className="text-sm text-muted">
              Your share {formatMoney(myShare, cur)}
              {myPaid > 0 && ` · you paid ${formatMoney(myPaid, cur)}`} · total{" "}
              {formatMoney(expense.total_amount, cur)}
              {converted && ` ≈ ${converted}`}
            </p>
          </>
        ) : (
          <>
            <p className="text-xl font-bold text-muted">
              {formatMoney(expense.total_amount, cur)}
              {converted && (
                <span className="text-sm font-normal"> ≈ {converted}</span>
              )}
            </p>
            <p className="text-sm text-muted">
              You weren&apos;t part of this expense.
            </p>
          </>
        )}

        <p className="text-sm text-muted">{formatDate(expense.spent_at)}</p>
      </div>

      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold text-muted">Paid by</h2>
        {expense.expense_payers.map((p) => (
          <div key={p.member_id} className={row}>
            <span className="flex items-center gap-2.5">
              <Avatar name={nameOf(p.member_id)} />
              {nameOf(p.member_id)}
            </span>
            <span className="font-semibold">{formatMoney(p.amount, cur)}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold text-muted">
          {components.length > 1 ? "Split (in parts)" : "How it's split"}
        </h2>
        {components.map((c, idx) => (
          <div
            key={c.id}
            className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2 p-3 text-sm"
          >
            <div className="text-xs text-muted">
              {components.length > 1 && `Part ${idx + 1} · `}
              {methodLabel[c.method] ?? c.method}
              {c.basis === "fixed_amount" &&
                ` · covers ${formatMoney(c.amount ?? 0, cur)}`}
            </div>
            <ul className="flex flex-col gap-0.5">
              {c.expense_split_entries.map((en) => (
                <li key={en.member_id} className="flex justify-between">
                  <span>{nameOf(en.member_id)}</span>
                  <span className="text-muted">
                    {c.method === "exact" &&
                      formatMoney(en.exact_amount ?? 0, cur)}
                    {c.method === "percentage" && `${en.percent}%`}
                    {c.method === "shares" &&
                      `${en.weight} ${en.weight === 1 ? "share" : "shares"}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold text-muted">Each person&apos;s share</h2>
        {expense.expense_allocations.map((a) => (
          <div key={a.member_id} className={row}>
            <span className="flex items-center gap-2.5">
              <Avatar name={nameOf(a.member_id)} />
              {nameOf(a.member_id)}
            </span>
            <span className="font-semibold">{formatMoney(a.amount, cur)}</span>
          </div>
        ))}
      </section>

      {canEdit && (
        <div className="flex gap-3">
          <Link
            href={`/groups/${id}/expenses/${expenseId}/edit`}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-ink hover:bg-primary-hover"
          >
            Edit
          </Link>
          <form action={deleteExpense}>
            <input type="hidden" name="groupId" value={id} />
            <input type="hidden" name="expenseId" value={expenseId} />
            <SubmitButton
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-neg disabled:opacity-50"
              pendingText="Deleting…"
            >
              Delete
            </SubmitButton>
          </form>
        </div>
      )}
    </main>
  );
}
