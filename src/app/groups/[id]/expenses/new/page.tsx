import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import NewExpenseForm from "./NewExpenseForm";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, default_currency")
    .eq("id", id)
    .maybeSingle();

  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("id, display_name, user_id")
    .eq("group_id", id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  const myMemberId = members?.find((m) => m.user_id === user.id)?.id;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-muted hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">New expense</h1>
      </div>

      <NewExpenseForm
        groupId={group.id}
        currency={group.default_currency}
        members={members ?? []}
        defaultPayer={myMemberId}
      />
    </main>
  );
}
