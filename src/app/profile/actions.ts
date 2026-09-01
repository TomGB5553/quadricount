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

export async function updatePayoutDetails(formData: FormData) {
  await requireUser();

  const iban = String(formData.get("iban") ?? "").trim();
  const note = String(formData.get("paymentNote") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_payout_details", {
    p_iban: iban || null,
    p_payment_note: note || null,
  });
  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}
