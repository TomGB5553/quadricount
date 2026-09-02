import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/balances");

  const t = await getT();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">Quadricount</h1>
        <p className="text-muted">{t("landing.tagline")}</p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login?mode=signup"
          className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover"
        >
          {t("landing.createAccount")}
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-line bg-surface px-5 py-2.5 font-semibold hover:bg-surface-2"
        >
          {t("landing.signIn")}
        </Link>
      </div>
    </main>
  );
}
