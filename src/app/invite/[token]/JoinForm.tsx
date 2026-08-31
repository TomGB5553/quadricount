"use client";

import { useActionState, useState } from "react";
import { acceptInvitationState } from "./actions";

type Claimable = { id: string; display_name: string };

export default function JoinForm({
  token,
  claimable,
  defaultName,
}: {
  token: string;
  claimable: Claimable[];
  defaultName: string;
}) {
  const [state, formAction, pending] = useActionState(acceptInvitationState, {
    error: "",
  });
  const [choice, setChoice] = useState("new");

  return (
    <form action={formAction} className="flex w-full flex-col gap-3 text-left">
      <input type="hidden" name="token" value={token} />

      {claimable.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-muted">
            Are you one of these people already in the group?
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
              Yes, I&apos;m {m.display_name}
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
            No, add me as a new member
          </label>
        </fieldset>
      )}

      {choice === "new" && (
        <label className="flex flex-col gap-1 text-sm">
          Your name in this group
          <input
            name="displayName"
            required
            defaultValue={defaultName}
            maxLength={100}
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          />
        </label>
      )}

      {state.error && <p className="text-sm text-neg">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-ink disabled:opacity-50"
      >
        {pending ? "Joining…" : "Join group"}
      </button>
    </form>
  );
}
