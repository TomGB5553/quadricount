import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Use in a Server Component / Server Action to require a signed-in user.
// Redirects to /login when there is no session; otherwise returns the user.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return user;
}
