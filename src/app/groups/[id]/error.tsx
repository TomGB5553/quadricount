"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";

// Catches errors thrown while rendering a group page or running one of its
// server actions (e.g. a rejected expense edit) — shows a friendly retry
// instead of the bare "A server error occurred" screen.
export default function GroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  const params = useParams<{ id: string }>();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-extrabold tracking-tight">
        {t("error.heading")}
      </h1>
      <p className="text-sm text-muted">{t("error.body")}</p>
      {error.message && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          {error.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-ink hover:bg-primary-hover"
        >
          {t("error.retry")}
        </button>
        {params?.id && (
          <Link
            href={`/groups/${params.id}`}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium"
          >
            {t("error.back")}
          </Link>
        )}
      </div>
    </main>
  );
}
