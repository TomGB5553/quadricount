import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { addMember } from "../actions";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, default_currency")
    .eq("id", id)
    .maybeSingle();

  // RLS returns nothing if the user isn't a member — treat as not found.
  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("id, display_name, role, status, user_id")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  const isOwner = members?.some(
    (m) => m.user_id === user.id && m.role === "owner" && m.status === "active",
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 p-6">
      <div>
        <Link href="/groups" className="text-sm text-gray-500 hover:underline">
          ← All groups
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{group.name}</h1>
        {group.description && (
          <p className="text-gray-500">{group.description}</p>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Members</h2>
        <ul className="flex flex-col gap-1">
          {members?.map((m) => (
            <li
              key={m.id}
              className={`flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm ${
                m.status === "inactive" ? "text-gray-400" : ""
              }`}
            >
              <span>{m.display_name}</span>
              {m.role === "owner" && (
                <span className="text-xs text-gray-500">owner</span>
              )}
              {!m.user_id && m.status === "active" && (
                <span className="text-xs text-gray-400">not joined</span>
              )}
              {m.status === "inactive" && (
                <span className="text-xs">inactive</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <form action={addMember} className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Add a member</h2>
          <input type="hidden" name="groupId" value={group.id} />
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              name="name"
              required
              maxLength={100}
              placeholder="Marc"
              className="rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <button className="rounded bg-black px-3 py-2 text-white">
            Add member
          </button>
        </form>
      )}
    </main>
  );
}
