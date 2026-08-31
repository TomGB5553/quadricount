// A small colored circle with the person's initials. Deterministic color per
// name so the same person looks the same everywhere.
const COLORS = [
  "#E0674A",
  "#2E9A6B",
  "#3B82C4",
  "#B4791F",
  "#8B5C9E",
  "#C0567A",
  "#4C9AA6",
  "#7A8B3C",
];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Avatar({
  name,
  size = 28,
}: {
  name: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: colorFor(name),
        fontSize: size * 0.4,
      }}
    >
      {initials(name)}
    </span>
  );
}
