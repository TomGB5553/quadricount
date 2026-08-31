"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

async function accept(
  token: string,
  memberId: string | null,
  displayName: string | null,
): Promise<string> {
  await requireUser();
  if (!token) throw new Error("Missing invite");

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
    p_member_id: memberId,
    p_display_name: displayName,
  });
  if (error) throw new Error(error.message);
  return groupId as string;
}

// Plain form action (placeholder-specific invites — no choice to make).
export async function acceptInvitation(formData: FormData) {
  const groupId = await accept(
    String(formData.get("token") ?? ""),
    null,
    null,
  );
  redirect(`/groups/${groupId}`);
}

// useActionState variant for the group-invite join form.
export async function acceptInvitationState(
  _prev: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  const token = String(formData.get("token") ?? "");
  const choice = String(formData.get("choice") ?? "new");
  const displayName = String(formData.get("displayName") ?? "");

  const memberId = choice && choice !== "new" ? choice : null;
  const name = choice === "new" ? displayName : null;

  let groupId: string;
  try {
    groupId = await accept(token, memberId, name);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
  redirect(`/groups/${groupId}`);
}
