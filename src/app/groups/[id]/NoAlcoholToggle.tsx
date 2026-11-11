"use client";

import { useRef } from "react";
import { useT } from "@/lib/i18n/client";
import { setMemberNoAlcohol } from "../actions";

// Checkbox that saves as soon as it's ticked. "card" = your own setting at the
// top of the Members tab; "chip" = small toggle on a placeholder member's row.
export default function NoAlcoholToggle({
  groupId,
  memberId,
  checked,
  variant = "card",
}: {
  groupId: string;
  memberId: string;
  checked: boolean;
  variant?: "card" | "chip";
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setMemberNoAlcohol}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="memberId" value={memberId} />
      {variant === "card" ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input
            type="checkbox"
            name="noAlcohol"
            defaultChecked={checked}
            onChange={() => formRef.current?.requestSubmit()}
            className="mt-1"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">🚱 {t("members.noAlcohol")}</span>
            <span className="text-xs text-muted">{t("members.noAlcoholHint")}</span>
          </span>
        </label>
      ) : (
        <label
          title={t("members.noAlcohol")}
          className={`flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 ${
            checked ? "bg-primary/15 text-ink" : "text-muted"
          }`}
        >
          <input
            type="checkbox"
            name="noAlcohol"
            defaultChecked={checked}
            onChange={() => formRef.current?.requestSubmit()}
            className="sr-only"
          />
          🚱 {checked ? t("members.noAlcoholShort") : ""}
        </label>
      )}
    </form>
  );
}
