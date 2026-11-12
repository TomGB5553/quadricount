"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { isLikelySamePerson } from "@/lib/sameName";
import { mergeMembers } from "../actions";

type M = {
  id: string;
  display_name: string;
  role: string;
  user_id: string | null;
};

// Owner-only: fold a duplicate member into another one. Shares and payments
// are added together, so nobody else's balance moves.
export default function MergeMembers({
  groupId,
  members,
}: {
  groupId: string;
  members: M[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(mergeMembers, {
    error: "",
  });

  // first likely duplicate pair, to pre-fill the form
  let suggested: [M, M] | null = null;
  for (let i = 0; i < members.length && !suggested; i++)
    for (let j = i + 1; j < members.length && !suggested; j++)
      if (isLikelySamePerson([members[i].display_name], [members[j].display_name]))
        suggested = [members[i], members[j]];
  // the owner can't be the one that disappears; prefer keeping an account
  const order = (a: M, b: M): [M, M] =>
    a.role === "owner" || (a.user_id && !b.user_id) ? [a, b] : [b, a];
  const [sKeep, sRemove] = suggested ? order(...suggested) : [null, null];

  const [open, setOpen] = useState(false);
  const [keep, setKeep] = useState(sKeep?.id ?? "");
  const [remove, setRemove] = useState(sRemove?.id ?? "");
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.display_name ?? "";
  const bothAccounts =
    !!members.find((m) => m.id === keep)?.user_id &&
    !!members.find((m) => m.id === remove)?.user_id;

  const select = "rounded-xl border border-line bg-surface px-3 py-2 text-sm";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm font-semibold text-primary hover:underline"
      >
        {suggested
          ? t("merge.suggest", {
              a: suggested[0].display_name,
              b: suggested[1].display_name,
            })
          : t("merge.open")}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-sm"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <p className="font-semibold">{t("merge.title")}</p>
      <p className="text-muted">{t("merge.explain")}</p>

      <label className="flex flex-col gap-1">
        {t("merge.keep")}
        <select
          name="keep"
          required
          value={keep}
          onChange={(e) => setKeep(e.target.value)}
          className={select}
        >
          <option value="">—</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        {t("merge.remove")}
        <select
          name="remove"
          required
          value={remove}
          onChange={(e) => setRemove(e.target.value)}
          className={select}
        >
          <option value="">—</option>
          {members
            .filter((m) => m.role !== "owner" && m.id !== keep)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
        </select>
      </label>

      {keep && remove && (
        <p className="rounded-xl bg-surface-2 p-3">
          {t("merge.summary", { keep: nameOf(keep), remove: nameOf(remove) })}
          {bothAccounts && <> {t("merge.bothAccounts", { remove: nameOf(remove) })}</>}
        </p>
      )}

      {state.error && <p className="text-neg">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !keep || !remove}
          className="flex-1 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-ink disabled:opacity-50"
        >
          {pending ? "…" : t("merge.confirm")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-line px-4 py-2"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
