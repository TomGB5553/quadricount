"use client";

import { useState } from "react";

// Client-side tab switch: all three panels are server-rendered and passed in,
// so switching is instant with no network round-trip.
export default function GroupTabs({
  labels,
  panels,
  // rendered only while the first tab (Expenses) is active
  firstTabAction,
}: {
  labels: string[];
  panels: React.ReactNode[];
  firstTabAction?: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  return (
    <>
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(i)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              active === i
                ? "bg-surface font-semibold text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {panels[active]}
      {active === 0 && firstTabAction}
    </>
  );
}
