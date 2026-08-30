"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

// A Server Action: this function runs on the server when the form is submitted.
export async function createGroup(formData: FormData) {
  await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "EUR").trim();

  if (!name) return;

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("create_group", {
    p_name: name,
    p_default_currency: currency || "EUR",
  });

  if (error) throw new Error(error.message);

  redirect(`/groups/${groupId}`);
}

export async function addMember(formData: FormData) {
  await requireUser();

  const groupId = String(formData.get("groupId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!groupId || !name) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_group_member", {
    p_group_id: groupId,
    p_display_name: name,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/groups/${groupId}`);
}
