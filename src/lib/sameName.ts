// Loose "is this probably the same person?" matching, used to suggest
// existing group members when someone joins. Deliberately wide: a false
// suggestion costs one "it's not me" click, a missed one creates a duplicate.

// "Tóm  G." -> ["tom", "g"]; digits and punctuation are dropped,
// so "andy01600" -> ["andy"].
function tokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function namesMatch(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return false;

  // whole name, ignoring spacing: "Jean Paul" = "jeanpaul"
  if (ta.join("") === tb.join("")) return true;
  // same first name: "Tom" = "Tom G." = "tom.durand"
  if (ta[0] === tb[0]) return true;
  // one first name starts the other (3+ letters): "Thom" ~ "Thomas"
  const [short, long] = ta[0].length <= tb[0].length ? [ta[0], tb[0]] : [tb[0], ta[0]];
  return short.length >= 3 && long.startsWith(short);
}

// True if any of `mine` (display name, username…) matches any of `theirs`.
export function isLikelySamePerson(
  mine: (string | null | undefined)[],
  theirs: (string | null | undefined)[],
): boolean {
  const a = mine.filter((x): x is string => !!x);
  const b = theirs.filter((x): x is string => !!x);
  return a.some((x) => b.some((y) => namesMatch(x, y)));
}
