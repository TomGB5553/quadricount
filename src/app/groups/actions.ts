"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getFxRate } from "@/lib/fx";

const todayStr = () => new Date().toISOString().slice(0, 10);

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
  let payers: { member_id: string; amount: number }[];
  let components: unknown;
  try {
    payers = JSON.parse(String(formData.get("payers") ?? "[]"));
    components = JSON.parse(String(formData.get("components") ?? "[]"));
  } catch {
    throw new Error("Could not read the split details");
  }
  payers = payers.filter((p) => p && p.member_id && p.amount > 0);

  if (!groupId || !description) {
    throw new Error("Fill in a description");
  }
  if (payers.length === 0) {
    throw new Error("Record who paid");
  }
  if (!Array.isArray(components) || components.length === 0) {
    throw new Error("Add a split");
  }

  const payerSum = payers.reduce((s, p) => s + p.amount, 0);
  if (payerSum !== amount) {
    throw new Error(
      `Payer amounts add up to ${(payerSum / 100).toFixed(2)}, but the total is ${(
        amount / 100
      ).toFixed(2)}`,
    );
  }

  const supabase = await createClient();
  const { data: expenseId, error } = await supabase.rpc(
    "create_expense_with_splits",
    {
      p_group_id: groupId,
      p_description: description,
      p_total_amount: amount,
      p_currency: currency || null,
      p_spent_at: spentAt,
      p_payers: payers,
      p_components: components,
    },
  );

  if (error) throw new Error(error.message);

  await lockFxRate(supabase, "expenses", expenseId as string, groupId, currency, spentAt);

  redirect(`/groups/${groupId}`);
}

// For a foreign-currency expense/settlement, look up the conversion rate to the
// group's default currency (on the transaction date) and store it on the row.
async function lockFxRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "expenses" | "settlements",
  rowId: string,
  groupId: string,
  currency: string,
  date: string | null,
) {
  const { data: group } = await supabase
    .from("groups")
    .select("default_currency")
    .eq("id", groupId)
    .single();
  const groupCurrency = group?.default_currency;
  const rowCurrency = currency || groupCurrency;
  if (!groupCurrency || !rowCurrency || rowCurrency === groupCurrency) return;

  const rate = await getFxRate(rowCurrency, groupCurrency, date ?? todayStr());
  if (rate !== 1) {
    await supabase
      .from(table)
      .update({ fx_rate_to_group_currency: rate })
      .eq("id", rowId);
  }
}

export async function setMemberStatus(formData: FormData) {
  await requireUser();

  const groupId = String(formData.get("groupId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!groupId || !memberId || !["active", "inactive"].includes(status)) {
    throw new Error("Invalid request");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", {
    p_member_id: memberId,
    p_status: status,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/groups/${groupId}`);
}

export async function recordSettlement(formData: FormData) {
  await requireUser();

  const groupId = String(formData.get("groupId") ?? "");
  const fromMember = String(formData.get("fromMember") ?? "");
  const toMember = String(formData.get("toMember") ?? "");
  const amount = toMinorUnits(String(formData.get("amount") ?? ""));
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const settledAt = String(formData.get("settledAt") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!groupId || !fromMember || !toMember) {
    throw new Error("Pick who paid and who received");
  }
  if (fromMember === toMember) {
    throw new Error("A payment needs two different people");
  }

  const supabase = await createClient();
  const { data: settlementId, error } = await supabase.rpc("record_settlement", {
    p_group_id: groupId,
    p_from_member: fromMember,
    p_to_member: toMember,
    p_amount: amount,
    p_currency: currency || null,
    p_settled_at: settledAt,
    p_note: note,
  });

  if (error) throw new Error(error.message);

  await lockFxRate(
    supabase,
    "settlements",
    settlementId as string,
    groupId,
    currency,
    settledAt,
  );

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
