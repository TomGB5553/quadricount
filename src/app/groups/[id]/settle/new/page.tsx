import { redirect } from "next/navigation";

// "Record a payment" now lives behind the group's + button, on the same page
// as adding an expense. Keep this URL working for old links.
export default async function NewSettlementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; amount?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams({ mode: "payment" });
  if (sp.from) q.set("from", sp.from);
  if (sp.to) q.set("to", sp.to);
  if (sp.amount) q.set("amount", sp.amount);
  redirect(`/groups/${id}/expenses/new?${q.toString()}`);
}
