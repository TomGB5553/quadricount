"use client";

import { useRef, useState } from "react";

// Client-side tab switch: all three panels are server-rendered and passed in,
// so switching is instant with no network round-trip. On touch screens a
// horizontal swipe moves to the previous/next tab.
export default function GroupTabs({
  labels,
  panels,
  // rendered only while the first tab (Expenses) is active
  firstTabAction,
  // extra control at the end of the tab bar (e.g. the Settings button)
  trailing,
}: {
  labels: string[];
  panels: React.ReactNode[];
  firstTabAction?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    // Don't hijack swipes inside horizontally scrollable bits (chip rows…)
    // or form fields.
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      if (
        el.scrollWidth > el.clientWidth + 1 &&
        getComputedStyle(el).overflowX !== "visible"
      ) {
        start.current = null;
        return;
      }
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
        start.current = null;
        return;
      }
      el = el.parentElement;
    }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    // Mostly-horizontal and long enough to be intentional.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setActive((a) =>
      dx < 0 ? Math.min(labels.length - 1, a + 1) : Math.max(0, a - 1),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
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
        {trailing}
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="flex min-h-[50vh] flex-col"
      >
        {panels[active]}
      </div>
      {active === 0 && firstTabAction}
    </>
  );
}
