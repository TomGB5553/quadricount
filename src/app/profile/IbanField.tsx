"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

// "•••• •••• •••• 189": everything hidden except the last 3 characters.
function mask(raw: string) {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (s.length <= 3) return s;
  return ("•".repeat(s.length - 3) + s.slice(-3)).replace(/(.{4})/g, "$1 ").trim();
}

const icon = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// The saved IBAN stays masked until you ask to see it, so it isn't readable
// over your shoulder. The value is always submitted with the form either way.
export default function IbanField({ defaultValue }: { defaultValue: string }) {
  const t = useT();
  const [value, setValue] = useState(defaultValue);
  // nothing saved yet -> just show the empty field
  const [shown, setShown] = useState(!defaultValue);

  const field =
    "w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-mono";

  return (
    <div className="flex flex-col gap-1 text-sm font-medium">
      <label htmlFor="iban-input">{t("profile.iban")}</label>
      <div className="flex items-center gap-2">
        {shown ? (
          <input
            id="iban-input"
            name="iban"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="FR76 3000 6000 0112 3456 7890 189"
            autoCapitalize="characters"
            autoComplete="off"
            className={field}
          />
        ) : (
          <>
            <input type="hidden" name="iban" value={value} />
            <div className={`${field} select-none truncate text-muted`}>
              {mask(value)}
            </div>
          </>
        )}
        {value && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-surface px-3 py-2.5 text-xs font-semibold shadow-sm ring-1 ring-line/60 hover:bg-surface-2"
          >
            {shown ? (
              <svg {...icon}>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg {...icon}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
            {shown ? t("profile.ibanHide") : t("profile.ibanShow")}
          </button>
        )}
      </div>
    </div>
  );
}
