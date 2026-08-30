import { headers } from "next/headers";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import CopyLink from "./CopyLink";

export default async function InviteMemberPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("group_members")
    .select("id, display_name, group_id, user_id")
    .eq("id", memberId)
    .maybeSingle();

  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_member_id: memberId,
  });

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      <Link
        href={`/groups/${id}`}
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to the group
      </Link>
      <h1 className="text-2xl font-bold">Invite {member?.display_name}</h1>

      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : (
        <CopyLink url={`${origin}/invite/${token}`} />
      )}
    </main>
  );
}
