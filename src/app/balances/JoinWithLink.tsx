"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

// Pull the invite token out of a pasted link (".../invite/<token>") or a bare token.
function extractToken(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/invite\/([^/?#\s]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{6,}$/.test(s)) return s;
  return null;
}

export default function JoinWithLink() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function go(text: string) {
    const token = extractToken(text);
    if (!token) {
      setError(true);
      return;
    }
    router.push(`/invite/${encodeURIComponent(token)}`);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm font-semibold text-muted underline underline-offset-2"
      >
        {t("joinLink.open")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3"
    >
      <label className="text-sm font-semibold" htmlFor="join-link">
        {t("joinLink.label")}
      </label>
      <div className="flex gap-2">
        <input
          id="join-link"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          placeholder="https://…/invite/…"
          className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              setValue(text);
              go(text);
            } catch {
              // clipboard read refused — user can paste manually
            }
          }}
          className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
        >
          {t("joinLink.paste")}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{t("joinLink.invalid")}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-ink"
        >
          {t("joinLink.join")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl px-3 py-2 text-sm text-muted"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
