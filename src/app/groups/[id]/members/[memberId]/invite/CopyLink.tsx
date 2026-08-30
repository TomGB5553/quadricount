"use client";

import { useState } from "react";

export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
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
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Send this link to the person. When they open it and sign in, they take
        over this spot in the group.
      </p>
    </div>
  );
}
