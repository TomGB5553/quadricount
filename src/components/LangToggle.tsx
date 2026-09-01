import { getLocale } from "@/lib/i18n/server";
import { setLocale } from "@/lib/i18n/actions";

// FR / EN switch. Server component + server action so it works without JS and
// re-renders the whole tree with the new locale.
export default async function LangToggle() {
  const locale = await getLocale();
  const other = locale === "fr" ? "en" : "fr";

  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={other} />
      <button
        type="submit"
        className="rounded-md border border-line px-1.5 py-0.5 text-xs font-semibold text-muted hover:text-ink"
        aria-label={other === "fr" ? "Passer en français" : "Switch to English"}
      >
        {other.toUpperCase()}
      </button>
    </form>
  );
}
