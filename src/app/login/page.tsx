"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Usernames are stored in Supabase Auth as a synthetic email the user never
// sees. Existing accounts created with a real email still sign in with it.
const USER_DOMAIN = "quadricount.app";
const toLoginEmail = (handle: string) =>
  handle.includes("@") ? handle.trim() : `${handle.trim().toLowerCase()}@${USER_DOMAIN}`;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "signup") {
      setMode("signup");
    }
  }, []);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (mode === "signup" && !/^[a-z0-9_]{3,20}$/.test(username.toLowerCase())) {
      return setErrorMsg(
        "Username: 3–20 characters, letters, numbers or underscores.",
      );
    }

    setBusy(true);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: toLoginEmail(username),
        password,
      });
      setBusy(false);
      if (error)
        return setErrorMsg(
          error.message.match(/invalid login/i)
            ? "Wrong username or password."
            : error.message,
        );
    } else {
      const handle = username.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: `${handle}@${USER_DOMAIN}`,
        password,
        options: { data: { username: handle, display_name: handle } },
      });
      setBusy(false);
      if (error)
        return setErrorMsg(
          error.message.match(/already registered/i)
            ? "That username is taken."
            : error.message,
        );
      if (!data.session)
        return setErrorMsg("Could not sign you in — try again.");
    }

    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") ? next : "/");
    router.refresh();
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
          Split expenses with friends and groups. No email needed.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Username
            <input
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={field}
              placeholder="alex"
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

          {isSignup && (
            <p className="text-xs text-muted">
              There&apos;s no password reset — keep it safe. You can add a
              recovery email later.
            </p>
          )}

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
