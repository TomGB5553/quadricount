"use client";

import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";

export default function CopyLink({ url }: { url: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // Phones can open the native share sheet (WhatsApp, Messages…).
  // false on the server, real value in the browser — no hydration mismatch.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="flex-1 rounded-xl border border-line px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // clipboard blocked — the field is selectable as a fallback
            }
          }}
          className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-ink"
        >
          {copied ? t("common.copied") : t("common.copy")}
        </button>
      </div>
      {canShare && (
        <button
          type="button"
          onClick={() => {
            navigator.share({ url }).catch(() => {
              // user closed the share sheet — nothing to do
            });
          }}
          className="min-h-11 rounded-xl border border-line px-3 py-2 text-sm font-semibold"
        >
          {t("common.share")}
        </button>
      )}
    </div>
  );
}
