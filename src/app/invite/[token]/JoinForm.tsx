"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { isLikelySamePerson } from "@/lib/sameName";
import { acceptInvitationState } from "./actions";

export type InviteMember = {
  id: string;
  display_name: string;
  username: string | null;
  claimed: boolean;
};

// Group-invite join flow:
//   1. "Is that you?" — members whose name looks like the signed-in user's.
//   2. "It's not me" (or no match) → open spots to claim, or join as new.
export default function JoinForm({
  token,
  members,
  myName,
  myUsername,
}: {
  token: string;
  members: InviteMember[];
  myName: string;
  myUsername: string | null;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(acceptInvitationState, {
    error: "",
  });

  const matches = members.filter((m) =>
    isLikelySamePerson([myName, myUsername], [m.display_name, m.username]),
  );
  const claimable = members.filter((m) => !m.claimed);

  const [step, setStep] = useState<"suggest" | "choose">(
    matches.length ? "suggest" : "choose",
  );
  const [choice, setChoice] = useState("new");
  // member linked to another account that the user said is them
  const [otherAccount, setOtherAccount] = useState<InviteMember | null>(null);

  const primaryBtn =
    "rounded-xl bg-primary px-4 py-2 text-sm text-primary-ink disabled:opacity-50";
  const softBtn =
    "rounded-xl border border-line bg-surface px-4 py-2 text-sm disabled:opacity-50";

  if (step === "suggest") {
    return (
      <form action={formAction} className="flex w-full flex-col gap-3 text-left">
        <input type="hidden" name="token" value={token} />
        <p className="text-center text-sm text-muted">
          {matches.length > 1 ? t("invite.isThisYouMany") : t("invite.isThisYou")}
        </p>

        {matches.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-3"
          >
            <div className="flex flex-col">
              <span className="font-semibold">{m.display_name}</span>
              {m.username && (
                <span className="text-xs text-muted">@{m.username}</span>
              )}
            </div>
            {m.claimed ? (
              <button
                type="button"
                onClick={() => setOtherAccount(m)}
                className={primaryBtn}
              >
                {t("invite.yesMe")}
              </button>
            ) : (
              <button
                type="submit"
                name="choice"
                value={m.id}
                disabled={pending}
                className={primaryBtn}
              >
                {pending ? t("invite.joining") : t("invite.yesMe")}
              </button>
            )}
          </div>
        ))}

        {otherAccount && (
          <p className="rounded-xl bg-surface-2 p-3 text-sm">
            {t("invite.linkedToOther", {
              name: otherAccount.display_name,
              username: otherAccount.username ?? "",
            })}
          </p>
        )}

        {state.error && <p className="text-sm text-neg">{state.error}</p>}

        <button
          type="button"
          onClick={() => {
            setOtherAccount(null);
            setStep("choose");
          }}
          className={softBtn}
        >
          {matches.length > 1 ? t("invite.notMeMany") : t("invite.notMe")}
        </button>
      </form>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-3 text-left">
      <input type="hidden" name="token" value={token} />

      {claimable.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-muted">
            {t("invite.areYouOne")}
          </legend>
          {claimable.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="choice"
                value={m.id}
                checked={choice === m.id}
                onChange={(e) => setChoice(e.target.value)}
              />
              {t("invite.yesImOne", { name: m.display_name })}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="choice"
              value="new"
              checked={choice === "new"}
              onChange={(e) => setChoice(e.target.value)}
            />
            {t("invite.noNewMember")}
          </label>
        </fieldset>
      )}

      {choice === "new" && (
        <label className="flex flex-col gap-1 text-sm">
          {t("invite.yourNameInGroup")}
          <input
            name="displayName"
            required
            defaultValue={myName}
            maxLength={100}
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          />
        </label>
      )}

      {state.error && <p className="text-sm text-neg">{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? t("invite.joining") : t("invite.joinGroup")}
      </button>
    </form>
  );
}
