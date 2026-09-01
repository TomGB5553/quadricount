import { cookies } from "next/headers";
import { dictionaries } from "./dictionaries";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  makeT,
  type Locale,
  type TFn,
} from "./core";

// The locale for this request, from the `lang` cookie (set by the toggle).
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : DEFAULT_LOCALE;
}

// For server components: `const t = await getT();`
export async function getT(): Promise<TFn> {
  return makeT(await getLocale());
}

export async function getMessages(locale: Locale) {
  return dictionaries[locale];
}
