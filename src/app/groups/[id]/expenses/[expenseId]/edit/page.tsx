import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_SELECT, type FullExpense, toExpenseInitial } from "@/lib/expense";
import { getT } from "@/lib/i18n/server";
import NewExpenseForm from "../../new/NewExpenseForm";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  await requireUser();
  const supabase = await createClient();
  const t = await getT();

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

  // Include every member referenced by this expense, even if since removed.
  const { data: members } = await supabase
    .from("group_members")
    .select("id, display_name, status")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  const referenced = new Set([
    ...expense.expense_payers.map((p) => p.member_id),
    ...expense.expense_allocations.map((a) => a.member_id),
  ]);
  const formMembers = (members ?? []).filter(
    (m) => m.status === "active" || referenced.has(m.id),
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href={`/groups/${id}/expenses/${expenseId}`}
          className="text-sm text-muted hover:underline"
        >
          ← {expense.description}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t("expForm.editTitle")}</h1>
      </div>

      <NewExpenseForm
        groupId={id}
        currency={group?.default_currency ?? expense.currency}
        members={formMembers}
        expenseId={expenseId}
        initial={toExpenseInitial(expense)}
      />
    </main>
  );
}
