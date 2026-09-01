import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Thin top bar, shown only when signed in.
export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between px-5 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/groups" className="font-semibold text-muted hover:text-ink">
            Groupes
          </Link>
          <Link
            href="/balances"
            className="font-semibold text-muted hover:text-ink"
          >
            Bilan global
          </Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/profile"
            className="max-w-[9rem] truncate font-semibold text-muted hover:text-ink"
          >
            {profile?.display_name ?? "Profil"}
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-muted hover:text-ink">Se déconnecter</button>
          </form>
        </div>
      </div>
    </header>
  );
}
