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
    <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <Link href="/groups" className="font-semibold">
        Expense Splitter
      </Link>
      <form action="/auth/signout" method="post">
        <button className="text-sm text-gray-500 hover:text-black">
          Sign out
        </button>
      </form>
    </header>
  );
}
