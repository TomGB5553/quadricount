import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/groups");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">Quadricount</h1>
        <p className="text-muted">
          Share costs with friends, flatmates and trips — see who owes whom at a
          glance.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login?mode=signup"
          className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover"
        >
          Create an account
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-line bg-surface px-5 py-2.5 font-semibold hover:bg-surface-2"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
