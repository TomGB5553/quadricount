import { headers } from "next/headers";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import CopyLink from "@/components/CopyLink";

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
        className="text-sm text-muted hover:underline"
      >
        ← Back to the group
      </Link>
      <h1 className="text-2xl font-bold">Invite {member?.display_name}</h1>

      {error ? (
        <p className="text-sm text-neg">{error.message}</p>
      ) : (
        <>
          <CopyLink url={`${origin}/invite/${token}`} />
          <p className="text-xs text-muted">
            Send this link to {member?.display_name}. When they open it and sign
            in, they take over this spot — the group&apos;s past expenses for{" "}
            {member?.display_name} become theirs.
          </p>
        </>
      )}
    </main>
  );
}
