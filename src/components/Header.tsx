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

  const navLink =
    "-mx-1.5 whitespace-nowrap rounded-md px-1.5 py-1 font-semibold text-muted transition-colors hover:text-ink active:bg-surface-2";

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 py-2 text-[13px]">
        <nav className="flex items-center gap-1.5">
          <Link href="/groups" data-tap className={navLink}>
            {t("nav.groups")}
          </Link>
          <Link href="/balances" data-tap className={navLink}>
            {t("nav.overall")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/profile"
            data-tap
            className="-mx-1.5 max-w-[6.5rem] truncate rounded-md px-1.5 py-1 font-semibold text-muted transition-colors hover:text-ink active:bg-surface-2"
          >
            {profile?.display_name ?? t("nav.profile")}
          </Link>
          <LangToggle />
          <form action="/auth/signout" method="post" className="flex">
            <button
              className="rounded-md p-1.5 text-muted transition-colors hover:text-ink active:bg-surface-2"
              aria-label={t("nav.signOut")}
              title={t("nav.signOut")}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
