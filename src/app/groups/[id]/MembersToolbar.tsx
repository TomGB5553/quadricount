"use client";

import { useState } from "react";
import CopyLink from "@/components/CopyLink";
import SubmitButton from "@/components/SubmitButton";
import { useT } from "@/lib/i18n/client";
import { addMember, getGroupInviteToken } from "../actions";

type Open = null | "add" | "link";

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// Two actions at the top of the Members tab: add a member (name only), or
// reveal the shareable invite link in place — no page change either way.
export default function MembersToolbar({ groupId }: { groupId: string }) {
  const t = useT();
  const [open, setOpen] = useState<Open>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggleLink() {
    if (open === "link") return setOpen(null);
    setOpen("link");
    if (url) return;
    setLoading(true);
    setError("");
    const res = await getGroupInviteToken(groupId);
    if (res.token) setUrl(`${window.location.origin}/invite/${res.token}`);
    else setError(res.error ?? t("invite.somethingWrong"));
    setLoading(false);
  }

  const btn = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
      active
        ? "border-primary bg-surface-2 text-primary"
        : "border-line bg-surface hover:bg-surface-2"
    }`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(open === "add" ? null : "add")}
          aria-expanded={open === "add"}
          className={btn(open === "add")}
        >
          <svg {...iconProps}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("members.addNew")}
        </button>
        <button
          type="button"
          onClick={toggleLink}
          aria-expanded={open === "link"}
          className={btn(open === "link")}
        >
          <svg {...iconProps}>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          {t("members.inviteLink")}
        </button>
      </div>

      {open === "add" && (
        <form
          action={async (fd) => {
            await addMember(fd);
            setOpen(null);
          }}
          className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3"
        >
          <p className="text-xs text-muted">{t("members.addPlaceholderHint")}</p>
          <input type="hidden" name="groupId" value={groupId} />
          <input
            name="name"
            required
            autoFocus
            maxLength={100}
            placeholder={t("members.namePlaceholder")}
            className="rounded-xl border border-line bg-surface px-3 py-2.5"
          />
          <SubmitButton pendingText={t("common.adding")}>
            {t("members.addMember")}
          </SubmitButton>
        </form>
      )}

      {open === "link" && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3">
          {loading && (
            <p className="text-sm text-muted">{t("members.linkLoading")}</p>
          )}
          {error && <p className="text-sm text-neg">{error}</p>}
          {url && (
            <>
              <CopyLink url={url} />
              <p className="text-xs text-muted">{t("invite.groupHint")}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
