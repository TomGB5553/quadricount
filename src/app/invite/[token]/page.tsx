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
        <h1 className="text-xl font-bold">Lien d&apos;invitation invalide</h1>
        <p className="text-sm text-muted">
          Ce lien n&apos;est pas valide. Demande un nouveau lien à la personne
          qui t&apos;a invité.
        </p>
      </Shell>
    );
  }

  // Only placeholder invites get "used up".
  if (!preview.group_invite && (preview.accepted || preview.claimed)) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">
          Cette invitation a déjà été utilisée
        </h1>
        <p className="text-sm text-muted">
          La place de {preview.member_name} dans {preview.group_name} est déjà
          prise.
        </p>
        <Link href="/groups" className="text-sm underline">
          Aller à tes groupes
        </Link>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">Rejoindre {preview.group_name}</h1>
        <p className="text-sm text-muted">
          {preview.group_invite
            ? "Partagez vos dépenses ensemble."
            : `Tu es invité à reprendre la place de ${preview.member_name}.`}{" "}
          Connecte-toi ou crée un compte pour continuer.
        </p>
        <Link
          href={`/login?mode=signup&next=${encodeURIComponent(`/invite/${token}`)}`}
          className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-ink"
        >
          Continuer
        </Link>
      </Shell>
    );
  }

  // Placeholder-specific invite: single confirm.
  if (!preview.group_invite) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">Rejoindre {preview.group_name}</h1>
        <p className="text-sm text-muted">
          Tu vas reprendre la place de{" "}
          <strong>{preview.member_name}</strong> — sa part des dépenses passées
          devient la tienne.
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
      <h1 className="text-xl font-bold">Rejoindre {preview.group_name}</h1>
      <JoinForm
        token={token}
        claimable={preview.claimable_members}
        defaultName={profile?.display_name ?? ""}
      />
    </Shell>
  );
}
