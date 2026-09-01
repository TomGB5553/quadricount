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
    .select("id, display_name, user_id")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  // payout info for the members who are real users — RLS only returns rows
  // for people who share an active group with the viewer.
  const userIds = (members ?? [])
    .map((m) => m.user_id)
    .filter((u): u is string => !!u);
  const { data: payouts } = userIds.length
    ? await supabase
        .from("payout_details")
        .select("user_id, iban, payment_note")
        .in("user_id", userIds)
    : { data: [] };

  const payoutByMember: Record<
    string,
    { iban: string | null; payment_note: string | null }
  > = {};
  for (const m of members ?? []) {
    const p = payouts?.find((x) => x.user_id === m.user_id);
    if (p && (p.iban || p.payment_note)) {
      payoutByMember[m.id] = { iban: p.iban, payment_note: p.payment_note };
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-muted hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Record a payment</h1>
      </div>

      <SettleForm
        groupId={group.id}
        currency={group.default_currency}
        members={(members ?? []).map((m) => ({
          id: m.id,
          display_name: m.display_name,
        }))}
        payoutByMember={payoutByMember}
        prefill={prefill}
      />
    </main>
  );
}
