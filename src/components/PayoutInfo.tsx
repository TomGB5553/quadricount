"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

// "How to pay {name}" — their IBAN with a copy button, plus any free-text note.
export default function PayoutInfo({
  name,
  iban,
  note,
}: {
  name: string;
  iban: string | null;
  note: string | null;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  if (!iban && !note) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-2 p-3 text-sm">
      <span className="text-xs font-semibold text-muted">
        {t("settle.howToPay", { name })}
      </span>
      {iban && (
        <div className="flex items-center gap-2">
          <span className="flex-1 break-all font-mono text-xs">{iban}</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(iban);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {}
            }}
            className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-ink active:bg-primary-hover"
          >
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      )}
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}
