import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
import { createGroup } from "../actions";

export default async function NewGroupPage() {
  await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div>
        <Link href="/groups" className="text-sm text-muted hover:underline">
          ← Your groups
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
          New group
        </h1>
      </div>

      <form action={createGroup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Trip to Lisbon"
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Default currency
          <select
            name="currency"
            defaultValue="EUR"
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton
          className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50"
          pendingText="Creating…"
        >
          Create group
        </SubmitButton>
      </form>
    </main>
  );
}
