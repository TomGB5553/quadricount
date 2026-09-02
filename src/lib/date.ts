import type { Locale } from "./i18n/core";

// Expense / receipt dates are stored as plain "YYYY-MM-DD" strings.
// Shown in full: "26 août 2026" / "August 26, 2026".
export function formatDate(iso: string, locale: Locale = "fr"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  // Build from parts (not `new Date(iso)`) to avoid a UTC-parsing day shift.
  return new Date(y, m - 1, d).toLocaleDateString(
    locale === "fr" ? "fr-FR" : "en-US",
    { day: "numeric", month: "long", year: "numeric" },
  );
}
