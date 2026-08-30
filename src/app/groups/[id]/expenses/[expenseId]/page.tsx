import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { EXPENSE_SELECT, type FullExpense } from "@/lib/expense";
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

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, default_currency")
    .eq("id", id)
    .single();

  const { data: members } = await supabase
    .from("group_members")
    .select("id, display_name, user_id, role")
    .eq("group_id", id);

  const nameOf = (memberId: string) =>
    members?.find((m) => m.id === memberId)?.display_name ?? "Someone";
  const canEdit =
    expense.created_by === user.id ||
    !!members?.some((m) => m.user_id === user.id && m.role === "owner");

  const gc = group?.default_currency ?? expense.currency;
  const converted =
    expense.currency !== gc
      ? formatMoney(
          Math.round(
            expense.total_amount * (expense.fx_rate_to_group_currency || 1),
          ),
          gc,
        )
      : null;

  const components = [...expense.expense_split_components].sort(
    (a, b) => a.seq - b.seq,
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-gray-500 hover:underline"
        >
          ← {group?.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{expense.description}</h1>
        <p className="text-gray-500">
          {formatMoney(expense.total_amount, expense.currency)}
          {converted && ` (≈ ${converted})`} · {expense.spent_at}
        </p>
      </div>

      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-gray-500">Paid by</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {expense.expense_payers.map((p) => (
            <li
              key={p.member_id}
              className="flex justify-between rounded border border-gray-200 px-3 py-2"
            >
              <span>{nameOf(p.member_id)}</span>
              <span>{formatMoney(p.amount, expense.currency)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-500">Split</h2>
        {components.map((c, idx) => (
          <div
            key={c.id}
            className="flex flex-col gap-1 rounded border border-gray-200 p-3 text-sm"
          >
            <div className="text-xs text-gray-500">
              {components.length > 1 && `Part ${idx + 1} · `}
              {methodLabel[c.method] ?? c.method}
              {" · "}
              {c.basis === "remainder"
                ? "covers the rest"
                : `covers ${formatMoney(c.amount ?? 0, expense.currency)}`}
            </div>
            <ul className="flex flex-col gap-0.5">
              {c.expense_split_entries.map((en) => (
                <li key={en.member_id} className="flex justify-between">
                  <span>{nameOf(en.member_id)}</span>
                  <span className="text-gray-500">
                    {c.method === "exact" &&
                      formatMoney(en.exact_amount ?? 0, expense.currency)}
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

      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-gray-500">Each person owes</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {expense.expense_allocations.map((a) => (
            <li
              key={a.member_id}
              className="flex justify-between rounded border border-gray-200 px-3 py-2"
            >
              <span>{nameOf(a.member_id)}</span>
              <span>{formatMoney(a.amount, expense.currency)}</span>
            </li>
          ))}
        </ul>
      </section>

      {canEdit && (
        <div className="flex gap-3">
          <Link
            href={`/groups/${id}/expenses/${expenseId}/edit`}
            className="rounded bg-black px-3 py-2 text-sm text-white"
          >
            Edit
          </Link>
          <form action={deleteExpense}>
            <input type="hidden" name="groupId" value={id} />
            <input type="hidden" name="expenseId" value={expenseId} />
            <button className="rounded border border-gray-300 px-3 py-2 text-sm text-red-600">
              Delete
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
