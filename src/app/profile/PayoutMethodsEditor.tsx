"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { PayoutKind, PayoutMethod } from "@/lib/payout";

type Row = PayoutMethod & { key: number; shown: boolean };

// "•••• •••• •••• 189": everything hidden except the last 3 characters.
function mask(raw: string) {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (s.length <= 3) return s;
  return ("•".repeat(s.length - 3) + s.slice(-3)).replace(/(.{4})/g, "$1 ").trim();
}

const PLACEHOLDER: Record<PayoutKind, string> = {
  iban: "FR76 3000 6000 0112 3456 7890 189",
  revolut: "@camille",
  wero: "+33 6 12 34 56 78",
};

// Editable list of bank accounts / Revolut / Wero. Submitted as one JSON
// field ("methods"); saved IBANs stay masked until you ask to see them.
export default function PayoutMethodsEditor({
  initial,
}: {
  initial: PayoutMethod[];
}) {
  const t = useT();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((m, i) => ({ ...m, key: i, shown: m.kind !== "iban" })),
  );
  const [nextKey, setNextKey] = useState(initial.length);

  const field = "w-full rounded-xl border border-line bg-surface px-3 py-2.5";
  const chip =
    "rounded-xl bg-surface px-3 py-2 text-xs font-semibold shadow-sm ring-1 ring-line/60 hover:bg-surface-2";

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function add(kind: PayoutKind) {
    setRows((rs) => [...rs, { kind, value: "", label: null, key: nextKey, shown: true }]);
    setNextKey((k) => k + 1);
  }

  const payload = JSON.stringify(
    rows.map(({ kind, value, label }) => ({ kind, value, label })),
  );

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="methods" value={payload} />

      {rows.length === 0 && (
        <p className="text-xs text-muted">{t("profile.noMethods")}</p>
      )}

      {rows.map((r) => (
        <div
          key={r.key}
          className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t(`payout.${r.kind}`)}</span>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              className="text-xs font-semibold text-neg hover:underline"
            >
              {t("profile.removeMethod")}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {r.shown ? (
              <input
                value={r.value}
                onChange={(e) => update(r.key, { value: e.target.value })}
                placeholder={PLACEHOLDER[r.kind]}
                aria-label={t(`payout.${r.kind}`)}
                inputMode={r.kind === "wero" ? "tel" : undefined}
                autoCapitalize={r.kind === "iban" ? "characters" : "none"}
                autoComplete="off"
                className={`${field} ${r.kind === "iban" ? "font-mono" : ""}`}
              />
            ) : (
              <div className={`${field} select-none truncate font-mono text-muted`}>
                {mask(r.value)}
              </div>
            )}
            {r.kind === "iban" && r.value && (
              <button
                type="button"
                onClick={() => update(r.key, { shown: !r.shown })}
                aria-pressed={r.shown}
                className={`${chip} shrink-0 py-2.5`}
              >
                {r.shown ? t("profile.ibanHide") : t("profile.ibanShow")}
              </button>
            )}
          </div>

          <input
            value={r.label ?? ""}
            onChange={(e) => update(r.key, { label: e.target.value })}
            maxLength={50}
            placeholder={t("profile.methodLabelPlaceholder")}
            aria-label={t("profile.methodLabel")}
            className={`${field} text-sm`}
          />
        </div>
      ))}

      {rows.length < 10 && (
        <div className="flex flex-wrap gap-2">
          {(["iban", "revolut", "wero"] as const).map((k) => (
            <button key={k} type="button" onClick={() => add(k)} className={chip}>
              + {t(`payout.${k}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
