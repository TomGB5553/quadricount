import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AcceptButton from "./AcceptButton";

type Preview = {
  group_name: string;
  member_name: string;
  accepted: boolean;
  claimed: boolean;
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
        <p className="text-sm text-gray-500">
          This link is not valid. Ask whoever invited you for a new one.
        </p>
      </Shell>
    );
  }

  if (preview.accepted || preview.claimed) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">This invite has been used</h1>
        <p className="text-sm text-gray-500">
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
        <h1 className="text-xl font-bold">
          Join {preview.group_name}
        </h1>
        <p className="text-sm text-gray-500">
          You&apos;ve been invited to take the spot of{" "}
          <strong>{preview.member_name}</strong>. Sign in or create an account to
          accept.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          Sign in to continue
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold">Join {preview.group_name}</h1>
      <p className="text-sm text-gray-500">
        You&apos;ll take over the spot of <strong>{preview.member_name}</strong> —
        their share of past expenses becomes yours.
      </p>
      <AcceptButton token={token} />
    </Shell>
  );
}
