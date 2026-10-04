"use client";

import { useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { useT } from "@/lib/i18n/client";
import { formatMoney } from "@/lib/money";
import { setOpeningBalances } from "../../actions";

type Member = { id: string; display_name: string };
type Dir = "getsBack" | "owes";
type Row = { dir: Dir; amount: string };

const toMinor = (raw: string) => {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) ? Math.abs(Math.round(n * 100)) : 0;
};

export default function OpeningBalancesForm({
  groupId,
  currency,
  members,
}: {
  groupId: string;
  currency: string;
  members: Member[];
}) {
  const t = useT();
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      members.map((m) => [m.id, { dir: "owes" as Dir, amount: "" }]),
    ),
  );
  const patch = (id: string, p: Partial<Row>) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));

  let getsBack = 0;
  let owes = 0;
  for (const m of members) {
    const minor = toMinor(rows[m.id].amount);
    if (rows[m.id].dir === "getsBack") getsBack += minor;
    else owes += minor;
  }
  const diff = getsBack - owes;
  const balanced = diff === 0 && getsBack > 0;

  const seg = (active: boolean, tone: "pos" | "neg") =>
    `flex-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
      active
        ? `bg-surface font-semibold shadow-sm ${tone === "pos" ? "text-pos" : "text-neg"}`
        : "text-muted"
    }`;

  return (
    <form action={setOpeningBalances} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />

      <div className="flex flex-col gap-2">
        {members.map((m) => {
          const row = rows[m.id];
          const minor = toMinor(row.amount);
          const signed = row.dir === "getsBack" ? minor : -minor;
          return (
            <div
              key={m.id}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3"
            >
              <span className="text-sm font-medium">{m.display_name}</span>
              <div className="flex items-center gap-2">
                <div className="flex w-44 shrink-0 gap-1 rounded-xl bg-surface-2 p-1">
                  <button
                    type="button"
                    onClick={() => patch(m.id, { dir: "getsBack" })}
                    className={seg(row.dir === "getsBack", "pos")}
                  >
                    {t("opening.getsBack")}
                  </button>
                  <button
                    type="button"
                    onClick={() => patch(m.id, { dir: "owes" })}
                    className={seg(row.dir === "owes", "neg")}
                  >
                    {t("opening.owes")}
                  </button>
                </div>
                <input
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) => patch(m.id, { amount: e.target.value })}
                  placeholder="0.00"
                  aria-label={m.display_name}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm"
                />
              </div>
              <input
                type="hidden"
                name={`bal_${m.id}`}
                value={minor === 0 ? "" : (signed / 100).toFixed(2)}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2 p-3 text-sm">
        <div className="flex justify-between text-pos">
          <span>{t("opening.totalGetsBack", { amount: formatMoney(getsBack, currency) })}</span>
        </div>
        <div className="flex justify-between text-neg">
          <span>{t("opening.totalOwes", { amount: formatMoney(owes, currency) })}</span>
        </div>
        <p
          className={`mt-1 font-semibold ${balanced ? "text-pos" : "text-muted"}`}
        >
          {balanced
            ? t("opening.balanced")
            : t("opening.difference", {
                amount: formatMoney(Math.abs(diff), currency),
              })}
        </p>
      </div>

      <SubmitButton disabled={!balanced} pendingText={t("opening.saving")}>
        {t("opening.save")}
      </SubmitButton>
    </form>
  );
}
