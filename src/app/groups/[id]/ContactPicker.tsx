"use client";

import { useEffect, useState, useTransition } from "react";
import Avatar from "@/components/Avatar";
import { useT } from "@/lib/i18n/client";
import { isLikelySamePerson } from "@/lib/sameName";
import { addContact, getContacts, type Contact } from "../actions";

type Spot = { id: string; display_name: string };

// "From your other groups": one tap adds someone already linked to their
// account, so the app knows it's the same person everywhere. If an open
// (unclaimed) spot looks like them, offer to link them to it instead.
export default function ContactPicker({
  groupId,
  openSpots,
  query,
  onAdded,
}: {
  groupId: string;
  openSpots: Spot[];
  query: string;
  onAdded: () => void;
}) {
  const t = useT();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [picked, setPicked] = useState<Contact | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    getContacts(groupId).then(setContacts);
  }, [groupId]);

  if (!contacts?.length) return null;

  const names = (c: Contact) => [c.display_name, c.username];
  const shown = (
    query.trim()
      ? contacts.filter((c) => isLikelySamePerson([query], names(c)))
      : contacts
  ).slice(0, 8);
  const spotsFor = (c: Contact) =>
    openSpots.filter((s) => isLikelySamePerson(names(c), [s.display_name]));

  function add(c: Contact, memberId: string | null) {
    setError("");
    start(async () => {
      const res = await addContact(groupId, c.user_id, memberId);
      if (res.error) return setError(res.error);
      setContacts((cs) => cs?.filter((x) => x.user_id !== c.user_id) ?? null);
      setPicked(null);
      onAdded();
    });
  }

  function pick(c: Contact) {
    if (spotsFor(c).length) setPicked(c);
    else add(c, null);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted">
        {t("contacts.fromOtherGroups")}
      </p>

      {picked ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 text-sm">
          <p>{t("contacts.matchesSpot", { name: picked.display_name })}</p>
          {spotsFor(picked).map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={pending}
              onClick={() => add(picked, s.id)}
              className="rounded-xl bg-primary px-3 py-2 font-semibold text-primary-ink disabled:opacity-50"
            >
              {t("contacts.linkTo", { name: s.display_name })}
            </button>
          ))}
          <button
            type="button"
            disabled={pending}
            onClick={() => add(picked, null)}
            className="rounded-xl border border-line px-3 py-2 disabled:opacity-50"
          >
            {t("contacts.addAsNew")}
          </button>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="text-xs text-muted hover:underline"
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : shown.length ? (
        <div className="flex flex-wrap gap-2">
          {shown.map((c) => (
            <button
              key={c.user_id}
              type="button"
              disabled={pending}
              onClick={() => pick(c)}
              title={c.username ? `@${c.username}` : undefined}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              <Avatar name={c.display_name} />
              {c.display_name}
              <span className="text-muted">+</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">{t("contacts.noMatch")}</p>
      )}

      {error && <p className="text-sm text-neg">{error}</p>}
    </div>
  );
}
