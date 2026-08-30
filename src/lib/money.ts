// Amounts are stored as integer minor units (cents). Format for display.
export function formatMoney(minorUnits: number, currency: string): string {
  const value = minorUnits / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    // Unknown currency code — fall back to a plain number + code.
    return `${value.toFixed(2)} ${currency}`;
  }
}
