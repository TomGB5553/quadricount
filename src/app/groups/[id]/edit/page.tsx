import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currencies";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { getT } from "@/lib/i18n/server";
import { computeGroupBalances, settleUp } from "@/lib/balances";
import { deleteGroup, updateGroup } from "../../actions";

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const t = await getT();

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

  const [{ data: expenses }, { data: settlements }] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "total_amount, currency, fx_rate_to_group_currency, expense_payers(member_id, amount), expense_allocations(member_id, amount)",
      )
      .eq("group_id", id),
    supabase
      .from("settlements")
      .select("from_member, to_member, amount, currency, fx_rate_to_group_currency")
      .eq("group_id", id),
  ]);
  const currencyLocked =
    (expenses?.length ?? 0) + (settlements?.length ?? 0) > 0;
  const hasOpenBalances =
    settleUp(computeGroupBalances(expenses ?? [], settlements ?? []).net)
      .length > 0;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-muted transition-colors hover:underline active:text-ink"
        >
          ← {group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t("group.settings")}</h1>
      </div>

      <form action={updateGroup} className="flex flex-col gap-4">
        <input type="hidden" name="groupId" value={group.id} />

        <label className="flex flex-col gap-1 text-sm">
          {t("editGroup.name")}
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={group.name}
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("editGroup.description")}
          <input
            name="description"
            maxLength={200}
            defaultValue={group.description ?? ""}
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("editGroup.defaultCurrency")}
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
                {t("editGroup.currencyLocked")}
              </span>
            </>
          ) : (
            <select
              name="currency"
              defaultValue={group.default_currency}
              className="rounded-xl border border-line bg-surface px-3 py-2.5"
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
          <SubmitButton pendingText={t("common.saving")}>
            {t("common.save")}
          </SubmitButton>
          <Link
            href={`/groups/${id}`}
            className="rounded-xl border border-line px-3 py-2 text-sm"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>

      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-5">
        {hasOpenBalances && (
          <>
            <Link
              href={`/groups/${group.id}/close`}
              className="w-full rounded-2xl bg-primary py-3.5 text-center text-base font-bold text-primary-ink shadow-sm hover:bg-primary-hover"
            >
              {t("close.button")}
            </Link>
            <p className="text-xs text-muted">{t("close.hint")}</p>
          </>
        )}
        <form action={deleteGroup}>
          <input type="hidden" name="groupId" value={group.id} />
          <ConfirmSubmit
            className="text-sm font-medium text-neg hover:underline disabled:opacity-50"
            confirm={t(
              hasOpenBalances
                ? "editGroup.deleteConfirmUnsettled"
                : "editGroup.deleteConfirm",
              { name: group.name },
            )}
          >
            {hasOpenBalances
              ? t("editGroup.deleteAnyway")
              : t("editGroup.delete")}
          </ConfirmSubmit>
        </form>
      </div>
    </main>
  );
}
