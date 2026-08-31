"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "signup") {
      setMode("signup");
    }
  }, []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg("");
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setBusy(false);
      if (error) return setErrorMsg(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() || undefined } },
      });
      setBusy(false);
      if (error) return setErrorMsg(error.message);
      // Email confirmation on -> a user is returned but no session yet.
      if (!data.session) return setCheckEmail(true);
    }

    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") ? next : "/");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="max-w-sm text-sm text-gray-500">
          We sent a confirmation link to <strong>{email}</strong>. Click it, then
          come back and sign in.
        </p>
      </main>
    );
  }

  const isSignup = mode === "signup";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">
        {isSignup ? "Create your account" : "Sign in"}
      </h1>

      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
        {isSignup && (
          <label className="flex flex-col gap-1 text-sm">
            Your name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2"
              placeholder="Alex"
            />
          </label>
        )}

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
          {busy ? "…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(isSignup ? "signin" : "signup");
          setErrorMsg("");
        }}
        className="text-sm text-gray-500 underline"
      >
        {isSignup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </main>
  );
}
