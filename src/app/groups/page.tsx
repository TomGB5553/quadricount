import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
import { createGroup } from "./actions";

export default async function GroupsPage() {
  await requireUser();
  const supabase = await createClient();

  // RLS limits this to groups the user is a member of.
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, default_currency")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 p-6">
      <h1 className="text-2xl font-bold">Your groups</h1>

      <ul className="flex flex-col gap-2">
        {groups && groups.length > 0 ? (
          groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="block rounded-xl border border-line px-4 py-3 hover:bg-surface-2"
              >
                <span className="font-medium">{g.name}</span>
                <span className="ml-2 text-sm text-muted">
                  {g.default_currency}
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted">No groups yet.</li>
        )}
      </ul>

      <form action={createGroup} className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 className="font-semibold">New group</h2>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Trip to Lisbon"
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Default currency
          <select
            name="currency"
            defaultValue="EUR"
            className="rounded-xl border border-line px-3 py-2"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton pendingText="Creating…">Create group</SubmitButton>
      </form>
    </main>
  );
}
