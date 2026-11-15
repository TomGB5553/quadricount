"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

// Shown on the invite page to signed-out visitors browsing in Safari (not the
// home-screen app). iOS can't route links into a home-screen web app, and the
// two have separate logins, so we let people copy the link and paste it in the app.
export default function OpenInAppHint() {
  const t = useT();
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setShow(!standalone);
  }, []);

  if (!show) return null;

  return (
    <div className="mt-4 flex w-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-left">
      <p className="text-sm font-semibold">{t("invite.homeScreenTitle")}</p>
      <p className="text-sm text-muted">{t("invite.homeScreenBody")}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // clipboard blocked — nothing else to do
          }
        }}
        className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold"
      >
        {copied ? t("invite.linkCopied") : t("invite.copyInvite")}
      </button>
    </div>
  );
}
