import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import OpeningBalancesForm from "./OpeningBalancesForm";

export default async function OpeningBalancesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();
  const t = await getT();

  const [{ data: group }, { data: members }, { count: nExpenses }, { count: nSettlements }] =
    await Promise.all([
      supabase
        .from("groups")
        .select("id, name, default_currency")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("id, display_name")
        .eq("group_id", id)
        .eq("status", "active")
        .order("joined_at", { ascending: true }),
      supabase
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("group_id", id),
      supabase
        .from("settlements")
        .select("id", { count: "exact", head: true })
        .eq("group_id", id),
    ]);
  if (!group) notFound();

  // only for a brand-new group — afterwards the entry is a normal expense
  if ((nExpenses ?? 0) > 0 || (nSettlements ?? 0) > 0) {
    redirect(`/groups/${id}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-muted transition-colors hover:underline active:text-ink"
        >
          ← {group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t("opening.title")}</h1>
      </div>
      <p className="text-sm text-muted">{t("opening.intro")}</p>
      <p className="text-xs text-muted">{t("opening.hint")}</p>
      <OpeningBalancesForm
        groupId={id}
        currency={group.default_currency}
        members={members ?? []}
      />
    </main>
  );
}
