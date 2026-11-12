"use client";

import { useRef } from "react";
import { useT } from "@/lib/i18n/client";
import { setMemberNoAlcohol } from "../actions";

// Your own "I don't drink" setting for this group, saved as soon as it's ticked.
// Only for yourself — placeholders can't be flagged by others.
export default function NoAlcoholToggle({
  groupId,
  memberId,
  checked,
}: {
  groupId: string;
  memberId: string;
  checked: boolean;
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setMemberNoAlcohol}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="memberId" value={memberId} />
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
    </form>
  );
}
