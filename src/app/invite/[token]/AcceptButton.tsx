"use client";

import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { acceptInvitationState } from "./actions";

export default function AcceptButton({ token }: { token: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(acceptInvitationState, {
    error: "",
  });

  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <input type="hidden" name="token" value={token} />
      <button
        disabled={pending}
        className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-ink disabled:opacity-50"
      >
        {pending ? t("invite.joining") : t("invite.acceptJoin")}
      </button>
      {state.error && <p className="text-sm text-neg">{state.error}</p>}
    </form>
  );
}
