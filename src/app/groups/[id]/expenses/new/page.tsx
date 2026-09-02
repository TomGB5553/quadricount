import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import AddEntry from "./AddEntry";

export default async function AddEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    mode?: string;
    from?: string;
    to?: string;
    amount?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const t = await getT();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, default_currency")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("id, display_name, user_id, status")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  const all = (members ?? []).map((m) => ({
    id: m.id,
    display_name: m.display_name,
  }));
  const active = (members ?? [])
    .filter((m) => m.status === "active")
    .map((m) => ({ id: m.id, display_name: m.display_name }));
  const myMemberId = members?.find((m) => m.user_id === user.id)?.id;

  // payout info for the "record a payment" tab
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
          className="text-sm text-muted transition-colors hover:underline active:text-ink"
        >
          ← {group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t("add.title")}</h1>
      </div>

      <AddEntry
        groupId={group.id}
        currency={group.default_currency}
        activeMembers={active}
        allMembers={all}
        defaultPayer={myMemberId}
        canScan={!!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY)}
        payoutByMember={payoutByMember}
        initialMode={sp.mode === "payment" ? "payment" : "expense"}
        prefill={{ from: sp.from, to: sp.to, amount: sp.amount }}
      />
    </main>
  );
}
