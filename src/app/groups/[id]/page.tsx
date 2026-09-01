import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { computeGroupBalances, settleUp } from "@/lib/balances";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import Avatar from "@/components/Avatar";
import GroupTabs from "./GroupTabs";
import ExpensesPanel from "./ExpensesPanel";
import {
  addMember,
  deleteSettlement,
  setMemberStatus,
  updateMyGroupName,
} from "../actions";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: group }, { data: members }, { data: expenses }, { data: settlements }] =
    await Promise.all([
      supabase
        .from("groups")
        .select("id, name, description, default_currency")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("id, display_name, role, status, user_id")
        .eq("group_id", id)
        .order("joined_at", { ascending: true }),
      supabase
        .from("expenses")
        .select(
          "id, description, total_amount, currency, fx_rate_to_group_currency, spent_at, expense_payers(member_id, amount), expense_allocations(member_id, amount)",
        )
        .eq("group_id", id)
        .order("spent_at", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("settlements")
        .select(
          "id, from_member, to_member, amount, currency, fx_rate_to_group_currency, settled_at, note, source, created_by",
        )
        .eq("group_id", id)
        .order("settled_at", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  if (!group) notFound();

  const isOwner = members?.some(
    (m) => m.user_id === user.id && m.role === "owner" && m.status === "active",
  );
  const myMember = members?.find((m) => m.user_id === user.id) ?? null;
  const myMemberId = myMember?.id ?? null;
  const nameOf = (memberId: string) =>
    members?.find((m) => m.id === memberId)?.display_name ?? "Quelqu'un";

  const gc = group.default_currency;
  const { net: balances, currencies } = computeGroupBalances(
    expenses ?? [],
    settlements ?? [],
  );
  const hasConversions = currencies.some((c) => c !== gc);
  const byNetDesc = (a: { id: string }, b: { id: string }) =>
    (balances.get(b.id) ?? 0) - (balances.get(a.id) ?? 0);
  const activeMembers = (members ?? []).filter((m) => m.status === "active");
  const inactiveMembers = (members ?? []).filter((m) => m.status === "inactive");
  const orderedForBalances = [
    ...[...activeMembers].sort(byNetDesc),
    ...inactiveMembers
      .filter((m) => (balances.get(m.id) ?? 0) !== 0)
      .sort(byNetDesc),
    ...inactiveMembers.filter((m) => (balances.get(m.id) ?? 0) === 0),
  ];
  const transfers = settleUp(balances);
  const mine = transfers.filter(
    (t) => t.from === myMemberId || t.to === myMemberId,
  );
  const others = transfers.filter(
    (t) => t.from !== myMemberId && t.to !== myMemberId,
  );
  const myNet = myMemberId ? (balances.get(myMemberId) ?? 0) : null;

  const card = "rounded-2xl border border-line bg-surface";
  const row =
    "flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-3 text-sm";

  const settleHref = (t: { from: string; to: string; amount: number }) =>
    `/groups/${group.id}/settle/new?from=${t.from}&to=${t.to}&amount=${(
      t.amount / 100
    ).toFixed(2)}`;

  /* ---------- BALANCES PANEL (server-rendered) ---------- */
  const balancesPanel = (
    <section key="balances" className="flex flex-col gap-5">
      {mine.length > 0 && (
        <div className="flex flex-col gap-2">
          {mine.map((t, i) => {
            const iOwe = t.from === myMemberId;
            const other = nameOf(iOwe ? t.to : t.from);
            return (
              <Link
                key={i}
                href={settleHref(t)}
                className={`${card} flex items-center gap-3 p-4 hover:bg-surface-2`}
              >
                <Avatar name={other} size={40} />
                <div className="flex-1">
                  <div className="text-sm text-muted">
                    {iOwe ? "Tu dois" : `${other} te doit`}
                  </div>
                  <div
                    className={`text-lg font-extrabold ${iOwe ? "text-neg" : "text-pos"}`}
                  >
                    {formatMoney(t.amount, gc)}
                    {iOwe && (
                      <span className="text-sm font-semibold text-ink">
                        {" "}
                        à {other}
                      </span>
                    )}
                  </div>
                </div>
                <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-ink">
                  Rembourser
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-muted">Le solde de chacun</h3>
        {orderedForBalances.map((m) => {
          const net = balances.get(m.id) ?? 0;
          return (
            <div
              key={m.id}
              className={`${row} ${m.status === "inactive" ? "opacity-50" : ""}`}
            >
              <span className="flex items-center gap-2.5">
                <Avatar name={m.display_name} />
                {m.display_name}
                {m.status === "inactive" && (
                  <span className="text-xs">inactif</span>
                )}
              </span>
              <span
                className={
                  net > 0
                    ? "font-semibold text-pos"
                    : net < 0
                      ? "font-semibold text-neg"
                      : "text-muted"
                }
              >
                {net > 0
                  ? `récupère ${formatMoney(net, gc)}`
                  : net < 0
                    ? `doit ${formatMoney(-net, gc)}`
                    : "à jour"}
              </span>
            </div>
          );
        })}
      </div>

      {others.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-muted">Entre les autres</h3>
          {others.map((t, i) => (
            <Link
              key={i}
              href={settleHref(t)}
              className={`${row} hover:bg-surface-2`}
            >
              <span className="flex items-center gap-2">
                <Avatar name={nameOf(t.from)} size={22} />
                <span className="font-medium">{nameOf(t.from)}</span>
                <span className="text-muted">doit</span>
                <span className="font-semibold">
                  {formatMoney(t.amount, gc)}
                </span>
                <span className="text-muted">à</span>
                <Avatar name={nameOf(t.to)} size={22} />
                <span className="font-medium">{nameOf(t.to)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {transfers.length > 0 && (
        <Link
          href={`/groups/${group.id}/transfer/new`}
          className="text-xs text-muted underline"
        >
          Transférer un solde vers un autre groupe
        </Link>
      )}

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-muted">Remboursements</h3>
        {settlements && settlements.length > 0 ? (
          settlements.map((s) => {
            const canDelete =
              s.source === "manual_payment" &&
              (s.created_by === user.id || isOwner);
            return (
              <div key={s.id} className={row}>
                <span className="flex items-center gap-2">
                  <Avatar name={nameOf(s.from_member)} size={22} />
                  {nameOf(s.from_member)}
                  <span className="text-muted">a payé</span>
                  <Avatar name={nameOf(s.to_member)} size={22} />
                  {nameOf(s.to_member)}
                  {s.note && (
                    <span className="text-xs text-muted"> · {s.note}</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted">
                    {formatMoney(s.amount, s.currency)}
                  </span>
                  {canDelete && (
                    <form action={deleteSettlement}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input
                        type="hidden"
                        name="settlementId"
                        value={s.id}
                      />
                      <ConfirmSubmit
                        confirm={`Supprimer ce remboursement de ${formatMoney(
                          s.amount,
                          s.currency,
                        )} ?`}
                      >
                        Supprimer
                      </ConfirmSubmit>
                    </form>
                  )}
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted">Aucun remboursement enregistré.</p>
        )}
      </div>

      {hasConversions && (
        <p className="text-xs text-muted">
          Les montants dans d&apos;autres devises sont convertis en {gc} au taux
          de chaque transaction à sa date.
        </p>
      )}
    </section>
  );

  /* ---------- MEMBERS PANEL (server-rendered) ---------- */
  const membersPanel = (
    <section key="members" className="flex flex-col gap-3">
      {myMember && (
        <form
          action={updateMyGroupName}
          className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4"
        >
          <input type="hidden" name="groupId" value={group.id} />
          <label className="text-sm font-semibold">Ton nom dans ce groupe</label>
          <div className="flex gap-2">
            <input
              name="displayName"
              required
              maxLength={100}
              defaultValue={myMember.display_name}
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm"
            />
            <SubmitButton
              className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
              pendingText="…"
            >
              Enregistrer
            </SubmitButton>
          </div>
          <p className="text-xs text-muted">
            N&apos;affecte que ce groupe. Ton nom par défaut se règle dans ton
            profil.
          </p>
        </form>
      )}

      <Link
        href={`/groups/${group.id}/invite`}
        className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink hover:bg-primary-hover"
      >
        + Inviter quelqu&apos;un
      </Link>
      <div className="flex flex-col gap-1.5">
        {members?.map((m) => (
          <div
            key={m.id}
            className={`${row} ${m.status === "inactive" ? "opacity-50" : ""}`}
          >
            <span className="flex flex-1 items-center gap-2.5 font-medium">
              <Avatar name={m.display_name} />
              {m.display_name}
            </span>
            <div className="flex items-center gap-3 text-xs">
              {m.role === "owner" && <span className="text-muted">admin</span>}
              {!m.user_id && m.status === "active" && (
                <span className="text-muted">pas encore inscrit</span>
              )}
              {m.status === "inactive" && (
                <span className="text-muted">inactif</span>
              )}
              {!m.user_id && m.status === "active" && (
                <Link
                  href={`/groups/${group.id}/members/${m.id}/invite`}
                  className="font-semibold text-primary hover:underline"
                >
                  Inviter
                </Link>
              )}
              {isOwner && m.role !== "owner" && (
                <form action={setMemberStatus}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="memberId" value={m.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={m.status === "active" ? "inactive" : "active"}
                  />
                  <SubmitButton
                    className="text-muted hover:text-ink disabled:opacity-50"
                    pendingText="…"
                  >
                    {m.status === "active" ? "Retirer" : "Réactiver"}
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        action={addMember}
        className="mt-2 flex flex-col gap-2 border-t border-line pt-4"
      >
        <h3 className="text-sm font-semibold">Ajouter un membre fictif</h3>
        <p className="text-xs text-muted">
          Pour quelqu&apos;un qui n&apos;est pas encore sur l&apos;app — tu
          pourras l&apos;inviter à récupérer ce profil plus tard.
        </p>
        <input type="hidden" name="groupId" value={group.id} />
        <input
          name="name"
          required
          maxLength={100}
          placeholder="Nom"
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        />
        <SubmitButton pendingText="Ajout…">Ajouter le membre</SubmitButton>
      </form>
    </section>
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <Link href="/groups" className="text-sm text-muted hover:underline">
          ← Tous les groupes
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {group.name}
          </h1>
          {isOwner && (
            <Link
              href={`/groups/${group.id}/edit`}
              className="text-sm text-muted underline hover:text-ink"
            >
              Modifier
            </Link>
          )}
        </div>
        {group.description && (
          <p className="text-sm text-muted">{group.description}</p>
        )}
      </div>

      <div className={`${card} flex flex-col gap-1 p-4`}>
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Ton solde dans ce groupe
        </span>
        <span
          className={`text-2xl font-extrabold ${
            myNet && myNet > 0
              ? "text-pos"
              : myNet && myNet < 0
                ? "text-neg"
                : "text-muted"
          }`}
        >
          {myNet && myNet > 0
            ? `On te doit ${formatMoney(myNet, gc)}`
            : myNet && myNet < 0
              ? `Tu dois ${formatMoney(-myNet, gc)}`
              : "Tu es à jour"}
        </span>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/groups/${group.id}/expenses/new`}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-ink hover:bg-primary-hover"
        >
          Ajouter une dépense
        </Link>
        <Link
          href={`/groups/${group.id}/settle/new`}
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-center text-sm font-semibold hover:bg-surface-2"
        >
          Enregistrer un remboursement
        </Link>
      </div>

      <GroupTabs
        labels={["Dépenses", "Soldes", "Membres"]}
        panels={[
          <ExpensesPanel
            key="expenses"
            groupId={group.id}
            groupCurrency={gc}
            members={(members ?? []).map((m) => ({
              id: m.id,
              display_name: m.display_name,
            }))}
            expenses={expenses ?? []}
            myMemberId={myMemberId}
          />,
          balancesPanel,
          membersPanel,
        ]}
      />
    </main>
  );
}
