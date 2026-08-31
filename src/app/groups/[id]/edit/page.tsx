import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
import { updateGroup } from "../../actions";

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, default_currency")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership?.role !== "owner") notFound();

  const { count: expenseCount } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("group_id", id);
  const { count: settlementCount } = await supabase
    .from("settlements")
    .select("id", { count: "exact", head: true })
    .eq("group_id", id);
  const currencyLocked = (expenseCount ?? 0) + (settlementCount ?? 0) > 0;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-muted hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Edit group</h1>
      </div>

      <form action={updateGroup} className="flex flex-col gap-4">
        <input type="hidden" name="groupId" value={group.id} />

        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={group.name}
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <input
            name="description"
            maxLength={200}
            defaultValue={group.description ?? ""}
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Default currency
          {currencyLocked ? (
            <>
              <input
                type="hidden"
                name="currency"
                value={group.default_currency}
              />
              <input
                disabled
                value={group.default_currency}
                className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-muted"
              />
              <span className="text-xs text-muted">
                Locked — the group already has expenses or payments.
              </span>
            </>
          ) : (
            <select
              name="currency"
              defaultValue={group.default_currency}
              className="rounded-xl border border-line px-3 py-2"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </label>

        <div className="flex gap-3">
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
          <Link
            href={`/groups/${id}`}
            className="rounded-xl border border-line px-3 py-2 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
