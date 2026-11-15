"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { formatIban, type Payout, type PayoutMethod } from "@/lib/payout";

function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-ink active:bg-primary-hover"
    >
      {copied ? t("common.copied") : t("common.copy")}
    </button>
  );
}

function MethodRow({ m }: { m: PayoutMethod }) {
  const t = useT();
  const shown =
    m.kind === "iban" ? formatIban(m.value) : m.kind === "revolut" ? `@${m.value}` : m.value;
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-semibold text-muted">
          {t(`payout.${m.kind}`)}
          {m.label ? ` · ${m.label}` : ""}
        </span>
        <span className={`break-all text-xs ${m.kind === "iban" ? "font-mono" : ""}`}>
          {shown}
        </span>
      </div>
      {m.kind === "revolut" && (
        <a
          href={`https://revolut.me/${encodeURIComponent(m.value)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-line hover:bg-surface"
        >
          {t("payout.openRevolut")}
        </a>
      )}
      <CopyButton text={m.value} />
    </div>
  );
}

// "How to pay {name}" — each bank account / Revolut / Wero with a copy
// button, plus any free-text note.
export default function PayoutInfo({
  name,
  payout,
}: {
  name: string;
  payout: Payout | null | undefined;
}) {
  const t = useT();
  if (!payout || (payout.methods.length === 0 && !payout.note)) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm">
      <span className="text-xs font-semibold text-muted">
        {t("settle.howToPay", { name })}
      </span>
      {payout.methods.map((m, i) => (
        <MethodRow key={i} m={m} />
      ))}
      {payout.note && <span className="text-xs text-muted">{payout.note}</span>}
    </div>
  );
}
