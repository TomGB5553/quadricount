"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateDisplayName(formData: FormData) {
  await requireUser();

  const name = String(formData.get("displayName") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_display_name", {
    p_display_name: name,
  });
  if (error) throw new Error(error.message);

  // the name shows up all over the app, so refresh everything
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}
