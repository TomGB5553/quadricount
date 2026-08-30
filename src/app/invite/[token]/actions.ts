"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

async function accept(token: string): Promise<string> {
  await requireUser();
  if (!token) throw new Error("Missing invite");

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return groupId as string;
}

// Plain form action (used where we don't need inline errors).
export async function acceptInvitation(formData: FormData) {
  const groupId = await accept(String(formData.get("token") ?? ""));
  redirect(`/groups/${groupId}`);
}

// useActionState variant: returns { error } instead of throwing.
export async function acceptInvitationState(
  _prev: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  let groupId: string;
  try {
    groupId = await accept(String(formData.get("token") ?? ""));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
  redirect(`/groups/${groupId}`);
}
