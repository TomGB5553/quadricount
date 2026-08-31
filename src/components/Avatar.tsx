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
  ring = false,
  title,
}: {
  name: string;
  size?: number;
  ring?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        ring ? "ring-2 ring-primary ring-offset-1 ring-offset-surface" : ""
      }`}
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

// Overlapping row of avatars with a "+N" overflow chip.
export function AvatarStack({
  people,
  max = 5,
  size = 20,
}: {
  people: { name: string; ring?: boolean }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={i} className={i > 0 ? "-ml-1.5" : ""}>
          <Avatar name={p.name} size={size} ring={p.ring} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="-ml-1.5 inline-flex items-center justify-center rounded-full bg-surface-2 font-semibold text-muted ring-1 ring-line"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
