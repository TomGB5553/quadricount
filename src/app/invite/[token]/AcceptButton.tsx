"use client";

import { useActionState } from "react";
import { acceptInvitationState } from "./actions";

export default function AcceptButton({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvitationState, {
    error: "",
  });

  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <input type="hidden" name="token" value={token} />
      <button
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Joining…" : "Accept & join"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
