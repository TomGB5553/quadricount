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
        <p className="max-w-sm text-sm text-muted">
          We sent a confirmation link to <strong>{email}</strong>. Click it, then
          come back and sign in.
        </p>
      </main>
    );
  }

  const isSignup = mode === "signup";
  const field = "rounded-xl border border-line bg-surface px-3 py-2.5";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mb-5 text-sm text-muted">
          Split expenses with friends and groups.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {isSignup && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Your name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
                placeholder="Sam"
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
              placeholder="at least 6 characters"
            />
          </label>

          {errorMsg && <p className="text-sm text-neg">{errorMsg}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-xl bg-primary px-3 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50"
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
          className="mt-4 w-full text-center text-sm text-muted hover:text-ink"
        >
          {isSignup
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </div>
    </main>
  );
}
