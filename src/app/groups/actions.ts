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

// Parse a user-typed amount like "12.34" or "12,34" into integer minor units.
function toMinorUnits(raw: string): number {
  const n = Number(raw.replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a valid amount");
  return Math.round(n * 100);
}

export async function createExpense(formData: FormData) {
  await requireUser();

  const groupId = String(formData.get("groupId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = toMinorUnits(String(formData.get("amount") ?? ""));
  const spentAt = String(formData.get("spentAt") ?? "") || null;
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const payerId = String(formData.get("payerId") ?? "");
  const participantIds = formData.getAll("participants").map(String);

  if (!groupId || !description || !payerId || participantIds.length === 0) {
    throw new Error("Fill in description, payer and at least one participant");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_expense", {
    p_group_id: groupId,
    p_description: description,
    p_total_amount: amount,
    p_currency: currency || null,
    p_spent_at: spentAt,
    p_payers: [{ member_id: payerId, amount }],
    p_participant_ids: participantIds,
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
