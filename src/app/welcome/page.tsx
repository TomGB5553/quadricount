import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import Onboarding from "./Onboarding";

// First-run flow a new account lands on right after signing up.
export default async function WelcomePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return <Onboarding initialName={profile?.display_name ?? ""} />;
}
