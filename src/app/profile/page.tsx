import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/SubmitButton";
import { updateDisplayName } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .maybeSingle();

  const field = "rounded-xl border border-line bg-surface px-3 py-2.5 w-full";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link href="/groups" className="text-sm text-muted hover:underline">
          ← Your groups
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Profile</h1>
      </div>

      <form
        action={updateDisplayName}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Display name
          <input
            name="displayName"
            required
            maxLength={100}
            defaultValue={profile?.display_name ?? ""}
            placeholder="Alex"
            className={field}
          />
          <span className="text-xs text-muted">
            This is how you appear in every group.
          </span>
        </label>

        {profile?.username && (
          <div className="flex flex-col gap-1 text-sm font-medium">
            Username
            <input
              value={profile.username}
              readOnly
              className={`${field} opacity-60`}
            />
            <span className="text-xs text-muted">
              Used to sign in — can&apos;t be changed.
            </span>
          </div>
        )}

        {saved && (
          <p className="text-sm text-pos">Saved.</p>
        )}

        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </form>
    </main>
  );
}
