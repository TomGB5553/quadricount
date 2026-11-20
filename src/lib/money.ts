// Amounts are stored as integer minor units (cents). Format for display.
// The locale is fixed (not the browser's) so the server-rendered HTML and the
// browser produce exactly the same text — otherwise React reports a hydration error.
export function formatMoney(
  minorUnits: number,
  currency: string,
  locale = "fr-FR",
): string {
  const value = minorUnits / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    // Unknown currency code — fall back to a plain number + code.
    return `${value.toFixed(2)} ${currency}`;
  }
}
