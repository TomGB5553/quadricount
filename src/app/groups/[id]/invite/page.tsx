import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import CopyLink from "@/components/CopyLink";

export default async function GroupInvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const { data: token, error } = await supabase.rpc("create_group_invite", {
    p_group_id: id,
  });

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      <Link
        href={`/groups/${id}`}
        className="text-sm text-muted hover:underline"
      >
        ← {group.name}
      </Link>
      <h1 className="text-2xl font-bold">
        Inviter des personnes dans {group.name}
      </h1>

      {error ? (
        <p className="text-sm text-neg">{error.message}</p>
      ) : (
        <>
          <CopyLink url={`${origin}/invite/${token}`} />
          <p className="text-xs text-muted">
            Toute personne qui ouvre ce lien et se connecte peut rejoindre le
            groupe. Si elle y figure déjà comme membre, elle peut récupérer ce
            profil ; sinon elle rejoint en tant que nouveau membre. Le même lien
            fonctionne pour tout le monde.
          </p>
        </>
      )}
    </main>
  );
}
