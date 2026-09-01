import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/SubmitButton";
import { updateDisplayName, updatePayoutDetails } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: payout }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("payout_details")
      .select("iban, payment_note")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const field = "rounded-xl border border-line bg-surface px-3 py-2.5 w-full";
  const card =
    "flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      <div>
        <Link href="/groups" className="text-sm text-muted hover:underline">
          ← Your groups
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Profile</h1>
      </div>

      {saved && <p className="text-sm text-pos">Saved.</p>}
      {error && <p className="text-sm text-neg">{error}</p>}

      <form action={updateDisplayName} className={card}>
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
            The name suggested when you join a new group. You can set a
            different name per group from that group&apos;s Members tab.
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

        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </form>

      <form action={updatePayoutDetails} className={card}>
        <div>
          <h2 className="text-sm font-semibold">Payment info</h2>
          <p className="text-xs text-muted">
            Optional. Shown to people in your groups when they go to pay you
            back.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          IBAN
          <input
            name="iban"
            defaultValue={payout?.iban ?? ""}
            placeholder="FR76 3000 6000 0112 3456 7890 189"
            autoCapitalize="characters"
            className={`${field} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Other details
          <input
            name="paymentNote"
            maxLength={200}
            defaultValue={payout?.payment_note ?? ""}
            placeholder="Account name, or Revolut / PayPal / Lydia…"
            className={field}
          />
        </label>

        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </form>
    </main>
  );
}
