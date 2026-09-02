"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import NewExpenseForm from "./NewExpenseForm";
import SettleForm from "../../settle/new/SettleForm";

type Member = { id: string; display_name: string };
type Payout = { iban: string | null; payment_note: string | null };

// One entry point for "add an expense" and "record a payment", chosen with a
// toggle at the top so there's a single place to go from the group's + button.
export default function AddEntry({
  groupId,
  currency,
  activeMembers,
  allMembers,
  defaultPayer,
  canScan,
  payoutByMember,
  initialMode = "expense",
  prefill = {},
}: {
  groupId: string;
  currency: string;
  activeMembers: Member[];
  allMembers: Member[];
  defaultPayer?: string;
  canScan?: boolean;
  payoutByMember: Record<string, Payout>;
  initialMode?: "expense" | "payment";
  prefill?: { from?: string; to?: string; amount?: string };
}) {
  const t = useT();
  const [mode, setMode] = useState<"expense" | "payment">(initialMode);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {(["expense", "payment"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              mode === m
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {m === "expense" ? t("add.tabExpense") : t("add.tabPayment")}
          </button>
        ))}
      </div>

      {mode === "expense" ? (
        <NewExpenseForm
          groupId={groupId}
          currency={currency}
          members={activeMembers}
          defaultPayer={defaultPayer}
          canScan={canScan}
        />
      ) : (
        <SettleForm
          groupId={groupId}
          currency={currency}
          members={allMembers}
          payoutByMember={payoutByMember}
          prefill={prefill}
        />
      )}
    </div>
  );
}
