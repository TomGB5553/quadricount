"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "./core";

export async function setLocale(formData: FormData) {
  const next = formData.get("locale");
  if (!isLocale(next)) return;
  (await cookies()).set(LOCALE_COOKIE, next, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
