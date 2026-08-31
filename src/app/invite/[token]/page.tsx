import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AcceptButton from "./AcceptButton";
import JoinForm from "./JoinForm";

type Preview = {
  group_name: string;
  group_invite: boolean;
  member_name: string | null;
  accepted: boolean;
  claimed: boolean;
  claimable_members: { id: string; display_name: string }[];
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

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
        <h1 className="text-xl font-bold">Invalid invite link</h1>
        <p className="text-sm text-muted">
          This link is not valid. Ask whoever invited you for a new one.
        </p>
      </Shell>
    );
  }

  // Only placeholder invites get "used up".
  if (!preview.group_invite && (preview.accepted || preview.claimed)) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">This invite has been used</h1>
        <p className="text-sm text-muted">
          The spot for {preview.member_name} in {preview.group_name} is already
          taken.
        </p>
        <Link href="/groups" className="text-sm underline">
          Go to your groups
        </Link>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">Join {preview.group_name}</h1>
        <p className="text-sm text-muted">
          {preview.group_invite
            ? "Split expenses together."
            : `You've been invited to take the spot of ${preview.member_name}.`}{" "}
          Sign in or create an account to continue.
        </p>
        <Link
          href={`/login?mode=signup&next=${encodeURIComponent(`/invite/${token}`)}`}
          className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-ink"
        >
          Continue
        </Link>
      </Shell>
    );
  }

  // Placeholder-specific invite: single confirm.
  if (!preview.group_invite) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">Join {preview.group_name}</h1>
        <p className="text-sm text-muted">
          You&apos;ll take over the spot of{" "}
          <strong>{preview.member_name}</strong> — their share of past expenses
          becomes yours.
        </p>
        <AcceptButton token={token} />
      </Shell>
    );
  }

  // Group invite: choose to claim a slot or join as a new member.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <Shell>
      <h1 className="text-xl font-bold">Join {preview.group_name}</h1>
      <JoinForm
        token={token}
        claimable={preview.claimable_members}
        defaultName={profile?.display_name ?? ""}
      />
    </Shell>
  );
}
