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
        "Identifiant : 3 à 20 caractères — lettres, chiffres ou tirets bas.",
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
            ? "Identifiant ou mot de passe incorrect."
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
            ? "Cet identifiant est déjà pris."
            : error.message,
        );
      if (!data.session)
        return setErrorMsg("Connexion impossible — réessaie.");
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
          {isSignup ? "Créer ton compte" : "Content de te revoir"}
        </h1>
        <p className="mb-5 text-sm text-muted">
          Partage les dépenses entre amis et en groupe. Aucun e-mail requis.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Identifiant
            <input
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={field}
              placeholder="camille"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Mot de passe
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
              placeholder="au moins 6 caractères"
            />
          </label>

          {errorMsg && <p className="text-sm text-neg">{errorMsg}</p>}

          {isSignup && (
            <p className="text-xs text-muted">
              Aucune réinitialisation de mot de passe — garde-le en lieu sûr. Tu
              pourras ajouter un e-mail de secours plus tard.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-xl bg-primary px-3 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? "…" : isSignup ? "Créer le compte" : "Se connecter"}
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
            ? "Tu as déjà un compte ? Se connecter"
            : "Nouveau ici ? Créer un compte"}
        </button>
      </div>
    </main>
  );
}
