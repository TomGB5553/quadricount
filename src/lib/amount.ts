// Parse an amount the way people actually type it on a phone:
// "12.34", "12,34", "1 000", "1 000,50", "1,000.50", "1.000,50".
// Returns NaN when the text isn't a number.
export function parseAmount(raw: string): number {
  // Drop all spaces (incl. the non-breaking ones French formatting uses) and apostrophes.
  let s = raw.replace(/[\s  ']/g, "");
  if (s === "") return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: whichever comes last is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    s = s.replace(",", ".");
  }
  return Number(s);
}

// Amount -> integer minor units (cents). Invalid -> NaN.
export function parseMinor(raw: string): number {
  const n = parseAmount(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

// Today's date as "YYYY-MM-DD" in the user's own time zone (not UTC),
// so an expense added at 00:30 isn't dated yesterday.
export function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Same idea for server code, which runs in UTC: use the app's home time zone.
export function serverToday(timeZone = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}
