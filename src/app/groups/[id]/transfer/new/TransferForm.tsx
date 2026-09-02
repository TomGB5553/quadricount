"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { useT } from "@/lib/i18n/client";
import { transferBalance } from "../../../actions";

type Member = { id: string; display_name: string; user_id: string | null };
type Group = { id: string; name: string; members: Member[] };

export default function TransferForm({
  sourceGroup,
  sourceMembers,
  otherGroups,
  prefill,
}: {
  sourceGroup: { id: string; name: string };
  sourceMembers: Member[];
  otherGroups: Group[];
  prefill: { from?: string; to?: string; amount?: string };
}) {
  const t = useT();
  const [srcFrom, setSrcFrom] = useState(
    prefill.from ?? sourceMembers[0]?.id ?? "",
  );
  const [srcTo, setSrcTo] = useState(prefill.to ?? sourceMembers[1]?.id ?? "");
  const [targetId, setTargetId] = useState(otherGroups[0]?.id ?? "");

  const target = otherGroups.find((g) => g.id === targetId);

  // Match a source member to a member of the target group: same user first,
  // then same name, else the first member.
  function matchInTarget(memberId: string): string {
    const src = sourceMembers.find((m) => m.id === memberId);
    if (!src || !target) return "";
    const byUser =
      src.user_id && target.members.find((m) => m.user_id === src.user_id);
    if (byUser) return byUser.id;
    const byName = target.members.find(
      (m) => m.display_name.toLowerCase() === src.display_name.toLowerCase(),
    );
    return byName?.id ?? target.members[0]?.id ?? "";
  }

  const [tgtFromOverride, setTgtFromOverride] = useState<string | null>(null);
  const [tgtToOverride, setTgtToOverride] = useState<string | null>(null);
  const tgtFrom = tgtFromOverride ?? matchInTarget(srcFrom);
  const tgtTo = tgtToOverride ?? matchInTarget(srcTo);

  const nameOf = (id: string) =>
    sourceMembers.find((m) => m.id === id)?.display_name ?? "?";

  const valid = useMemo(
    () =>
      srcFrom &&
      srcTo &&
      srcFrom !== srcTo &&
      target &&
      tgtFrom &&
      tgtTo &&
      tgtFrom !== tgtTo,
    [srcFrom, srcTo, target, tgtFrom, tgtTo],
  );

  if (otherGroups.length === 0) {
    return (
      <p className="text-sm text-muted">
        {t("transfer.needOther")}{" "}
        <Link href="/balances" className="underline">
          {t("transfer.createOne")}
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={transferBalance} className="flex flex-col gap-4">
      <input type="hidden" name="sourceGroup" value={sourceGroup.id} />
      <input type="hidden" name="tgtFrom" value={tgtFrom} />
      <input type="hidden" name="tgtTo" value={tgtTo} />

      <p className="text-sm text-muted">
        {t("transfer.explain", { group: sourceGroup.name })}
      </p>

      <div className="flex items-end gap-2 text-sm">
        <label className="flex flex-1 flex-col gap-1">
          {t("transfer.whoOwes")}
          <select
            name="srcFrom"
            value={srcFrom}
            onChange={(e) => {
              setSrcFrom(e.target.value);
              setTgtFromOverride(null);
            }}
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            {sourceMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-2">→</span>
        <label className="flex flex-1 flex-col gap-1">
          {t("transfer.whoIsOwed")}
          <select
            name="srcTo"
            value={srcTo}
            onChange={(e) => {
              setSrcTo(e.target.value);
              setTgtToOverride(null);
            }}
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            {sourceMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t("transfer.amount")}
        <input
          name="amount"
          required
          inputMode="decimal"
          defaultValue={prefill.amount ?? ""}
          placeholder="0.00"
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("transfer.moveInto")}
        <select
          name="targetGroup"
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value);
            setTgtFromOverride(null);
            setTgtToOverride(null);
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
            {t("transfer.matchPeople", { group: target.name })}
          </p>
          <label className="flex items-center justify-between gap-2">
            {nameOf(srcFrom)} {t("transfer.isWord")}
            <select
              value={tgtFrom}
              onChange={(e) => setTgtFromOverride(e.target.value)}
              className="rounded-xl border border-line px-2 py-1"
            >
              {target.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            {nameOf(srcTo)} {t("transfer.isWord")}
            <select
              value={tgtTo}
              onChange={(e) => setTgtToOverride(e.target.value)}
              className="rounded-xl border border-line px-2 py-1"
            >
              {target.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        {t("transfer.note")}
        <input
          name="note"
          maxLength={200}
          placeholder={t("transfer.notePlaceholder")}
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        />
      </label>

      <div className="flex gap-3">
        <SubmitButton disabled={!valid} pendingText={t("transfer.moving")}>
          {t("transfer.move")}
        </SubmitButton>
        <Link
          href={`/groups/${sourceGroup.id}`}
          className="rounded-xl border border-line px-3 py-2 text-sm"
        >
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
