"use client";

import { useRef, useState } from "react";
import type { ParsedReceipt } from "@/lib/receipt/types";

// Downscale a photo in the browser before upload: phone shots are 3–8 MB, but
// ~1600px on the long edge is plenty for the model and much faster to send.
async function downscale(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);

  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      "image/jpeg",
      0.85,
    ),
  );
}

export default function ReceiptScanButton({
  currency,
  onResult,
}: {
  currency: string;
  onResult: (receipt: ParsedReceipt) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    setError("");
    setBusy(true);
    try {
      const image = await downscale(file);
      const body = new FormData();
      body.append("image", image, "receipt.jpg");
      body.append("currency", currency);

      const res = await fetch("/api/receipt/scan", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          [data?.error, data?.detail].filter(Boolean).join(" — ") ||
            "Scan failed.",
        );
      }
      onResult(data.receipt as ParsedReceipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm font-semibold hover:bg-surface disabled:opacity-50"
      >
        {busy ? "Reading receipt…" : "📷 Scan a receipt"}
        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          Beta
        </span>
      </button>
      <p className="text-xs text-muted">
        Beta — reads receipts with AI, which can get things wrong. Always
        check the items and total before saving.
      </p>
      {error && <p className="text-sm text-neg">{error}</p>}
    </div>
  );
}
