// Expense / receipt dates are stored as plain "YYYY-MM-DD" strings.
// Show them the French way: "01/09/2026".
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  // Build from parts (not `new Date(iso)`) to avoid a UTC-parsing day shift.
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR");
}
