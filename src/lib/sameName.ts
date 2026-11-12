// Loose name comparison for the duplicate-member guard:
// case-, accent- and whitespace-insensitive ("Tom", " tom ", "Tóm" all match).
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function findSameName(name: string, names: string[]): string | null {
  const n = normalizeName(name);
  if (!n) return null;
  return names.find((x) => normalizeName(x) === n) ?? null;
}
