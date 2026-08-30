"use client";

import Link from "next/link";
import { useState } from "react";
import { createExpense } from "../../../actions";

type Member = { id: string; display_name: string };

export default function NewExpenseForm({
  groupId,
  currency,
  members,
}: {
  groupId: string;
  currency: string;
  members: Member[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  // Everyone is a participant by default.
  const [participants, setParticipants] = useState<Set<string>>(
    new Set(members.map((m) => m.id)),
  );

  function toggle(id: string) {
    setParticipants((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <form action={createExpense} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />

      <label className="flex flex-col gap-1 text-sm">
        Description
        <input
          name="description"
          required
          maxLength={200}
          placeholder="Dinner"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Amount
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="0.00"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm">
          Currency
          <input
            name="currency"
            defaultValue={currency}
            maxLength={3}
            className="rounded border border-gray-300 px-3 py-2 uppercase"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Date
        <input
          type="date"
          name="spentAt"
          defaultValue={today}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Paid by
        <select
          name="payerId"
          required
          className="rounded border border-gray-300 px-3 py-2"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Split equally between</legend>
        {members.map((m) => (
          <label key={m.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              name="participants"
              value={m.id}
              checked={participants.has(m.id)}
              onChange={() => toggle(m.id)}
            />
            {m.display_name}
          </label>
        ))}
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={participants.size === 0}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          Add expense
        </button>
        <Link
          href={`/groups/${groupId}`}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
