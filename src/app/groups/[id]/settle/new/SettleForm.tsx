"use client";

import Link from "next/link";
import { useState } from "react";
import { recordSettlement } from "../../../actions";

type Member = { id: string; display_name: string };

export default function SettleForm({
  groupId,
  currency,
  members,
  prefill,
}: {
  groupId: string;
  currency: string;
  members: Member[];
  prefill: { from?: string; to?: string; amount?: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(prefill.from ?? members[0]?.id ?? "");
  const [to, setTo] = useState(prefill.to ?? members[1]?.id ?? "");

  return (
    <form action={recordSettlement} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />

      <label className="flex flex-col gap-1 text-sm">
        Who paid
        <select
          name="fromMember"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Who received it
        <select
          name="toMember"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </label>

      {from === to && (
        <p className="text-xs text-red-600">Pick two different people.</p>
      )}

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Amount
          <input
            name="amount"
            required
            inputMode="decimal"
            defaultValue={prefill.amount ?? ""}
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
          name="settledAt"
          defaultValue={today}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Note (optional)
        <input
          name="note"
          maxLength={200}
          placeholder="Bank transfer"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={from === to}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          Record payment
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
