"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

export default function GroupsHeader({ title }: { title: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // close the menu when tapping anywhere else
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  function go(text: string) {
    const token = extractToken(text);
    if (!token) {
      setError(true);
      return;
    }
    router.push(`/invite/${encodeURIComponent(token)}`);
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-label={t("groups.addMenu")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-ink shadow-md shadow-primary/25 transition-all hover:bg-primary-hover active:scale-95 ${
            menuOpen ? "rotate-45" : ""
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.75}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 flex w-56 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
            <Link
              href="/groups/new"
              className="px-4 py-3.5 text-base font-semibold hover:bg-surface-2"
            >
              {t("groups.createGroup")}
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setOpen(true);
              }}
              className="border-t border-line px-4 py-3.5 text-left text-base font-semibold hover:bg-surface-2"
            >
              {t("joinLink.open")}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!open) return header;

  return (
    <>
      {header}
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
        {error && (
          <p className="text-sm text-red-600">{t("joinLink.invalid")}</p>
        )}
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
    </>
  );
}
