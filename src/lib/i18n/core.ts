import { dictionaries, type Locale, type MessageKey } from "./dictionaries";

export type { Locale, MessageKey };
export const LOCALES: Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "lang";

export function isLocale(v: unknown): v is Locale {
  return v === "fr" || v === "en";
}

export type Vars = Record<string, string | number>;

// Look up a key for a locale, falling back to English then the key itself,
// and substitute {placeholders}.
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const table = dictionaries[locale] as Record<string, string>;
  let s = table[key] ?? (dictionaries.en as Record<string, string>)[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export type TFn = (key: MessageKey, vars?: Vars) => string;

export function makeT(locale: Locale): TFn {
  return (key, vars) => translate(locale, key, vars);
}
