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
    `flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
      active
        ? tone === "pos"
          ? "bg-pos-bg text-pos shadow-sm ring-1 ring-pos/40"
          : "bg-neg-bg text-neg shadow-sm ring-1 ring-neg/40"
        : "text-muted hover:text-ink"
    }`;

  return (
    <form action={setOpeningBalances} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />

      <div className="flex flex-col gap-2.5">
        {members.map((m) => {
          const row = rows[m.id];
          const minor = toMinor(row.amount);
          const signed = row.dir === "getsBack" ? minor : -minor;
          return (
            <div
              key={m.id}
              className="flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-sm ring-1 ring-line/60"
            >
              <span className="text-sm font-semibold">{m.display_name}</span>
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
                  className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm shadow-inner"
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

      <div
        className={`flex flex-col gap-1.5 rounded-xl p-3 text-sm shadow-sm ring-1 ${
          balanced ? "bg-pos-bg ring-pos/30" : "bg-surface ring-line/60"
        }`}
      >
        <div className="flex items-center gap-2 font-semibold text-pos">
          <span className="h-2 w-2 rounded-full bg-pos" aria-hidden />
          {t("opening.totalGetsBack", { amount: formatMoney(getsBack, currency) })}
        </div>
        <div className="flex items-center gap-2 font-semibold text-neg">
          <span className="h-2 w-2 rounded-full bg-neg" aria-hidden />
          {t("opening.totalOwes", { amount: formatMoney(owes, currency) })}
        </div>
        {balanced ? (
          <p className="mt-0.5 font-bold text-pos">{t("opening.balanced")}</p>
        ) : (
          diff !== 0 && (
            <>
              <p className="mt-0.5 font-bold">
                {t(diff > 0 ? "opening.shortOwes" : "opening.shortGetsBack", {
                  amount: formatMoney(Math.abs(diff), currency),
                })}
              </p>
              <p className="text-xs text-muted">{t("opening.missingTip")}</p>
            </>
          )
        )}
      </div>

      <SubmitButton disabled={!balanced} pendingText={t("opening.saving")}>
        {t("opening.save")}
      </SubmitButton>
    </form>
  );
}
