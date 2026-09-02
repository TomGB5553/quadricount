import { redirect } from "next/navigation";

// The groups list and the overall balance are one page now.
export default function GroupsPage() {
  redirect("/balances");
}
