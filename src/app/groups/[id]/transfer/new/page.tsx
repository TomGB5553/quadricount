import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import TransferForm from "./TransferForm";

export default async function NewTransferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; amount?: string }>;
}) {
  const { id } = await params;
  const prefill = await searchParams;
  await requireUser();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const { data: sourceMembers } = await supabase
    .from("group_members")
    .select("id, display_name, user_id")
    .eq("group_id", id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  // Every group the user belongs to, with its active members (RLS-scoped).
  const { data: allGroups } = await supabase
    .from("groups")
    .select(
      "id, name, group_members(id, display_name, user_id, status)",
    )
    .order("created_at", { ascending: false });

  const otherGroups = (allGroups ?? [])
    .filter((g) => g.id !== id)
    .map((g) => ({
      id: g.id,
      name: g.name,
      members: (g.group_members ?? [])
        .filter((m) => m.status === "active")
        .map((m) => ({
          id: m.id,
          display_name: m.display_name,
          user_id: m.user_id,
        })),
    }))
    .filter((g) => g.members.length >= 2);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-gray-500 hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Move a balance</h1>
      </div>

      <TransferForm
        sourceGroup={{ id: group.id, name: group.name }}
        sourceMembers={sourceMembers ?? []}
        otherGroups={otherGroups}
        prefill={prefill}
      />
    </main>
  );
}
