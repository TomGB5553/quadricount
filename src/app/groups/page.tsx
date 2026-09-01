import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { computeGroupBalances } from "@/lib/balances";
import { formatMoney } from "@/lib/money";

export default async function GroupsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, default_currency")
    .order("created_at", { ascending: false });

  const { data: members } = await supabase
    .from("group_members")
    .select("id, group_id, user_id");

  const { data: expenses } = await supabase
    .from("expenses")
    .select(
      "group_id, currency, fx_rate_to_group_currency, expense_payers(member_id, amount), expense_allocations(member_id, amount)",
    );

  const { data: settlements } = await supabase
    .from("settlements")
    .select(
      "group_id, currency, fx_rate_to_group_currency, from_member, to_member, amount",
    );

  const rows = (groups ?? []).map((g) => {
    const myMember = (members ?? []).find(
      (m) => m.group_id === g.id && m.user_id === user.id,
    );
    const { net } = computeGroupBalances(
      (expenses ?? []).filter((e) => e.group_id === g.id),
      (settlements ?? []).filter((s) => s.group_id === g.id),
    );
    const myNet = myMember ? (net.get(myMember.id) ?? 0) : 0;
    return { ...g, myNet };
  });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Tes groupes</h1>
        <Link
          href="/groups/new"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink hover:bg-primary-hover"
        >
          + Nouveau groupe
        </Link>
      </div>

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rows.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 hover:bg-surface-2"
              >
                <span className="font-semibold">{g.name}</span>
                <span
                  className={`text-sm font-semibold ${
                    g.myNet > 0
                      ? "text-pos"
                      : g.myNet < 0
                        ? "text-neg"
                        : "text-muted"
                  }`}
                >
                  {g.myNet > 0
                    ? `+${formatMoney(g.myNet, g.default_currency)}`
                    : g.myNet < 0
                      ? `−${formatMoney(-g.myNet, g.default_currency)}`
                      : "à jour"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          Aucun groupe pour l&apos;instant. Crées-en un pour commencer à
          partager les dépenses.
        </div>
      )}

      <Link
        href="/balances"
        className="text-sm text-muted underline hover:text-ink"
      >
        Voir ton bilan sur tous les groupes →
      </Link>
    </main>
  );
}
