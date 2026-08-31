import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">Expense Splitter</h1>

      {user ? (
        <>
          <p className="text-muted">
            Signed in as <strong>{user.email}</strong>
          </p>
          <Link
            href="/groups"
            className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-ink"
          >
            Go to your groups
          </Link>
        </>
      ) : (
        <>
          <p className="text-muted">Split expenses with friends and groups.</p>
          <div className="flex gap-3">
            <Link
              href="/login?mode=signup"
              className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-ink"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-line px-4 py-2 text-sm"
            >
              Sign in
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
