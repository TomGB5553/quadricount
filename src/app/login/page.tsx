"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

// Usernames are stored in Supabase Auth as a synthetic email the user never
// sees. Existing accounts created with a real email still sign in with it.
const USER_DOMAIN = "quadricount.app";
const toLoginEmail = (handle: string) =>
  handle.includes("@") ? handle.trim() : `${handle.trim().toLowerCase()}@${USER_DOMAIN}`;

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
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
      return setErrorMsg(t("login.errUsernameFormat"));
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
            ? t("login.errWrongCreds")
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
            ? t("login.errUsernameTaken")
            : error.message,
        );
      if (!data.session) return setErrorMsg(t("login.errNoSession"));
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
          {isSignup ? t("login.createYourAccount") : t("login.welcomeBack")}
        </h1>
        <p className="mb-5 text-sm text-muted">{t("login.subtitle")}</p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("login.username")}
            <input
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={field}
              placeholder={t("login.usernamePlaceholder")}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("login.password")}
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
              placeholder={t("login.passwordPlaceholder")}
            />
          </label>

          {errorMsg && <p className="text-sm text-neg">{errorMsg}</p>}

          {isSignup && (
            <p className="text-xs text-muted">{t("login.noReset")}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-xl bg-primary px-3 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50"
          >
            {busy
              ? "…"
              : isSignup
                ? t("login.createButton")
                : t("login.signInButton")}
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
          {isSignup ? t("login.toSignIn") : t("login.toSignUp")}
        </button>
      </div>
    </main>
  );
}
