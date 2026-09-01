"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Locale, type TFn } from "./core";

const Ctx = createContext<{ locale: Locale; t: TFn }>({
  locale: "fr",
  t: makeT("fr"),
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// For client components: `const t = useT();`
export function useT(): TFn {
  return useContext(Ctx).t;
}

export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
