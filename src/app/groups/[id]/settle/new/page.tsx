import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import SettleForm from "./SettleForm";

export default async function NewSettlementPage({
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
    .select("id, name, default_currency")
    .eq("id", id)
    .maybeSingle();

  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("id, display_name")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-gray-500 hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Record a payment</h1>
      </div>

      <SettleForm
        groupId={group.id}
        currency={group.default_currency}
        members={members ?? []}
        prefill={prefill}
      />
    </main>
  );
}
