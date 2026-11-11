"use client";

import Link from "next/link";
import { useState } from "react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { useT } from "@/lib/i18n/client";
import { formatMoney } from "@/lib/money";
import { closeAndTransferGroup } from "../../actions";

type Member = { id: string; display_name: string; user_id: string | null };
type Group = { id: string; name: string; members: Member[] };
type Debt = { from: string; to: string; amount: number };

export default function CloseForm({
  group,
  members,
  debts,
  otherGroups,
}: {
  group: { id: string; name: string; currency: string };
  members: Member[];
  debts: Debt[];
  otherGroups: Group[];
}) {
  const t = useT();
  const [targetId, setTargetId] = useState(otherGroups[0]?.id ?? "");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const target = otherGroups.find((g) => g.id === targetId);
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.display_name ?? "?";

  // Everyone who owes or is owed something.
  const people = [...new Set(debts.flatMap((d) => [d.from, d.to]))];

  // Same account first, then same name (case-insensitive), else nobody.
  function autoMatch(memberId: string): string {
    const src = members.find((m) => m.id === memberId);
    if (!src || !target) return "";
    const byUser =
      src.user_id && target.members.find((m) => m.user_id === src.user_id);
    if (byUser) return byUser.id;
    const byName = target.members.find(
      (m) => m.display_name.toLowerCase() === src.display_name.toLowerCase(),
    );
    return byName?.id ?? "";
  }
  const mapped = (id: string) => overrides[id] ?? autoMatch(id);
  const valid =
    !!target &&
    debts.every(
      (d) => mapped(d.from) && mapped(d.to) && mapped(d.from) !== mapped(d.to),
    );

  if (otherGroups.length === 0) {
    return (
      <p className="text-sm text-muted">
        {t("transfer.needOther")}{" "}
        <Link href="/groups/new" className="underline">
          {t("transfer.createOne")}
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={closeAndTransferGroup} className="flex flex-col gap-5">
      <input type="hidden" name="sourceGroup" value={group.id} />
      <p className="text-sm text-muted">
        {t("close.explain", { group: group.name })}
      </p>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-muted">{t("close.debts")}</h3>
        {debts.map((d, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl bg-surface px-3.5 py-3 text-sm shadow-sm ring-1 ring-line/60"
          >
            <span>
              {nameOf(d.from)} <span className="text-muted">→</span>{" "}
              {nameOf(d.to)}
            </span>
            <span className="font-semibold">
              {formatMoney(d.amount, group.currency)}
            </span>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t("transfer.moveInto")}
        <select
          name="targetGroup"
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value);
            setOverrides({});
          }}
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        >
          {otherGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      {target && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3 text-sm">
          <p className="text-xs text-muted">
            {t("close.matchPeople", { group: target.name })}
          </p>
          {people.map((id) => (
            <label key={id} className="flex items-center justify-between gap-2">
              <span>
                {nameOf(id)} {t("transfer.isWord")}
              </span>
              <select
                name={`map_${id}`}
                value={mapped(id)}
                onChange={(e) =>
                  setOverrides((o) => ({ ...o, [id]: e.target.value }))
                }
                className="rounded-xl border border-line px-2 py-1"
              >
                <option value="">{t("close.pickPerson")}</option>
                {target.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {valid ? (
        <ConfirmSubmit
          className="w-full rounded-2xl bg-primary py-3.5 text-base font-bold text-primary-ink shadow-sm hover:bg-primary-hover disabled:opacity-50"
          pendingText={t("transfer.moving")}
          confirm={t("close.confirm", {
            group: group.name,
            target: target?.name ?? "",
          })}
        >
          {t("close.button")}
        </ConfirmSubmit>
      ) : (
        <button
          type="button"
          disabled
          className="w-full rounded-2xl bg-primary py-3.5 text-base font-bold text-primary-ink opacity-50"
        >
          {t("close.button")}
        </button>
      )}
    </form>
  );
}
