"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Runs in the browser so it can hold form state and call Supabase directly.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(mode: "signin" | "signup") {
    setBusy(true);
    setErrorMsg("");
    const supabase = createClient();

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // Session cookie is now set. Continue to ?next= (invite flow) or home.
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") ? next : "/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit("signin");
        }}
        className="flex w-full max-w-sm flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
            placeholder="you@example.com"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
            placeholder="at least 6 characters"
          />
        </label>

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {busy ? "…" : "Sign in"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => submit("signup")}
          className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Create an account
        </button>
      </form>
    </main>
  );
}
