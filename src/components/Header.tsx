import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Thin top bar, shown only when signed in, so Sign out is reachable everywhere.
export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <header className="flex items-center justify-between border-b border-line px-4 py-3">
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/groups" className="font-semibold">
          Expense Splitter
        </Link>
        <Link href="/groups" className="text-muted hover:text-ink">
          Groups
        </Link>
        <Link href="/balances" className="text-muted hover:text-ink">
          Overall
        </Link>
      </nav>
      <form action="/auth/signout" method="post">
        <button className="text-sm text-muted hover:text-ink">
          Sign out
        </button>
      </form>
    </header>
  );
}
