import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import LangToggle from "./LangToggle";

// Thin top bar, shown only when signed in.
export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const t = await getT();
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
            {t("nav.groups")}
          </Link>
          <Link
            href="/balances"
            className="font-semibold text-muted hover:text-ink"
          >
            {t("nav.overall")}
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/profile"
            className="max-w-[7rem] truncate font-semibold text-muted hover:text-ink"
          >
            {profile?.display_name ?? t("nav.profile")}
          </Link>
          <LangToggle />
          <form action="/auth/signout" method="post">
            <button className="text-muted hover:text-ink">
              {t("nav.signOut")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
