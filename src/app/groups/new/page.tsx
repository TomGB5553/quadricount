import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
import { getT } from "@/lib/i18n/server";
import { createGroup } from "../actions";

export default async function NewGroupPage() {
  const user = await requireUser();
  const t = await getT();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const field = "rounded-xl border border-line bg-surface px-3 py-2.5";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div>
        <Link
          href="/balances"
          className="text-sm text-muted transition-colors hover:underline active:text-ink"
        >
          {t("groups.backToYours")}
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
          {t("newGroup.title")}
        </h1>
      </div>

      <form action={createGroup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("newGroup.name")}
          <input
            name="name"
            required
            maxLength={100}
            placeholder={t("newGroup.namePlaceholder")}
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("newGroup.myName")}
          <input
            name="myName"
            required
            maxLength={100}
            defaultValue={profile?.display_name ?? ""}
            className={field}
          />
          <span className="text-xs text-muted">{t("newGroup.myNameHint")}</span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("newGroup.defaultCurrency")}
          <select name="currency" defaultValue="EUR" className={field}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <SubmitButton
          className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50"
          pendingText={t("newGroup.creating")}
        >
          {t("newGroup.create")}
        </SubmitButton>
      </form>
    </main>
  );
}
