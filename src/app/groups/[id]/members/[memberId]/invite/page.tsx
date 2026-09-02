import { headers } from "next/headers";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import CopyLink from "@/components/CopyLink";
import { getT } from "@/lib/i18n/server";

export default async function InviteMemberPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  await requireUser();
  const supabase = await createClient();
  const t = await getT();

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
        className="text-sm text-muted transition-colors hover:underline active:text-ink"
      >
        {t("invite.memberBack")}
      </Link>
      <h1 className="text-2xl font-bold">
        {t("invite.memberTitle", { name: member?.display_name ?? "" })}
      </h1>

      {error ? (
        <p className="text-sm text-neg">{error.message}</p>
      ) : (
        <>
          <CopyLink url={`${origin}/invite/${token}`} />
          <p className="text-xs text-muted">
            {t("invite.memberHint", { name: member?.display_name ?? "" })}
          </p>
        </>
      )}
    </main>
  );
}
