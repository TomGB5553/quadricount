import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { computeGroupBalances, settleUp } from "@/lib/balances";
import ArchiveForm from "./ArchiveForm";

export default async function ArchiveGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const t = await getT();

  const [{ data: group }, { data: members }, { data: expenses }, { data: settlements }, { data: allGroups }] =
    await Promise.all([
      supabase.from("groups").select("id, name, default_currency, archived_at").eq("id", id).maybeSingle(),
      supabase
        .from("group_members")
        .select("id, display_name, user_id, role")
        .eq("group_id", id),
      supabase
        .from("expenses")
        .select(
          "total_amount, currency, fx_rate_to_group_currency, expense_payers(member_id, amount), expense_allocations(member_id, amount)",
        )
        .eq("group_id", id),
      supabase
        .from("settlements")
        .select("from_member, to_member, amount, currency, fx_rate_to_group_currency")
        .eq("group_id", id),
      supabase
        .from("groups")
        .select("id, name, archived_at, group_members(id, display_name, user_id, status)")
        .order("created_at", { ascending: false }),
    ]);
  if (!group) notFound();
  if (group.archived_at) redirect(`/groups/${id}`);
  const me = members?.find((m) => m.user_id === user.id);
  if (me?.role !== "owner") notFound();

  const debts = settleUp(
    computeGroupBalances(expenses ?? [], settlements ?? []).net,
  )
    .map((d) => ({ ...d, amount: Math.round(d.amount) }))
    .filter((d) => d.amount > 0);

  const otherGroups = (allGroups ?? [])
    .filter((g) => g.id !== id && !g.archived_at)
    .map((g) => ({
      id: g.id,
      name: g.name,
      members: (g.group_members ?? [])
        .filter((m) => m.status === "active")
        .map((m) => ({ id: m.id, display_name: m.display_name, user_id: m.user_id })),
    }))
    .filter((g) => g.members.length >= 2);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href={`/groups/${id}/edit`}
          className="text-sm text-muted transition-colors hover:underline active:text-ink"
        >
          ← {t("group.settings")}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t("archive.title")}</h1>
      </div>
      <ArchiveForm
        group={{ id: group.id, name: group.name, currency: group.default_currency }}
        members={(members ?? []).map((m) => ({
          id: m.id,
          display_name: m.display_name,
          user_id: m.user_id,
        }))}
        debts={debts}
        otherGroups={otherGroups}
      />
    </main>
  );
}
