import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import AcceptButton from "./AcceptButton";
import JoinForm, { type InviteMember } from "./JoinForm";

type Preview = {
  group_name: string;
  group_invite: boolean;
  member_name: string | null;
  accepted: boolean;
  claimed: boolean;
  claimable_members: { id: string; display_name: string }[];
  members?: InviteMember[];
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const t = await getT();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("invitation_preview", { p_token: token });
  const preview = data as Preview | null;

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      {children}
    </main>
  );

  if (!preview) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">{t("invite.invalidTitle")}</h1>
        <p className="text-sm text-muted">{t("invite.invalidBody")}</p>
      </Shell>
    );
  }

  // Only placeholder invites get "used up".
  if (!preview.group_invite && (preview.accepted || preview.claimed)) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">{t("invite.usedTitle")}</h1>
        <p className="text-sm text-muted">
          {t("invite.usedBody", {
            name: preview.member_name ?? "",
            group: preview.group_name,
          })}
        </p>
        <Link href="/balances" className="text-sm underline">
          {t("invite.goToGroups")}
        </Link>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">
          {t("invite.joinTitle", { group: preview.group_name })}
        </h1>
        <p className="text-sm text-muted">
          {preview.group_invite
            ? t("invite.splitTogether")
            : t("invite.invitedToTake", {
                name: preview.member_name ?? "",
              })}{" "}
          {t("invite.signInToContinue")}
        </p>
        <Link
          href={`/login?mode=signup&next=${encodeURIComponent(`/invite/${token}`)}`}
          className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-ink"
        >
          {t("invite.continue")}
        </Link>
      </Shell>
    );
  }

  // Placeholder-specific invite: single confirm.
  if (!preview.group_invite) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">
          {t("invite.joinTitle", { group: preview.group_name })}
        </h1>
        <p className="text-sm text-muted">
          {t("invite.takeOver", { name: preview.member_name ?? "" })}
        </p>
        <AcceptButton token={token} />
      </Shell>
    );
  }

  // Group invite: choose to claim a slot or join as a new member.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .maybeSingle();

  // Signed in with an account that's already in the group: nothing to do.
  if (
    profile?.username &&
    preview.members?.some((m) => m.username === profile.username)
  ) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">
          {t("invite.alreadyIn", { group: preview.group_name })}
        </h1>
        <Link
          href="/balances"
          className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-ink"
        >
          {t("invite.goToGroups")}
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold">
        {t("invite.joinTitle", { group: preview.group_name })}
      </h1>
      <JoinForm
        token={token}
        members={
          preview.members ??
          // before the join-suggestions migration: open spots only
          preview.claimable_members.map((m) => ({
            ...m,
            username: null,
            claimed: false,
          }))
        }
        myName={profile?.display_name ?? ""}
        myUsername={profile?.username ?? null}
      />
    </Shell>
  );
}
