"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import Avatar from "@/components/Avatar";

const STEPS = ["hello", "how", "name", "iban", "done"] as const;

// same rule as the DB check on payout_details.iban
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
const cleanIban = (s: string) => s.replace(/\s+/g, "").toUpperCase();
const groupIban = (s: string) => cleanIban(s).replace(/(.{4})/g, "$1 ").trim();

const primaryBtn =
  "w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50";
const field = "w-full rounded-xl border border-line bg-surface px-3 py-3";

export default function Onboarding({ initialName }: { initialName: string }) {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [name, setName] = useState(initialName);
  const [iban, setIban] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = (to: number) => {
    setError("");
    setDir(to > step ? "next" : "prev");
    setStep(to);
  };
  const next = () => go(step + 1);

  async function saveName() {
    const n = name.trim();
    if (!n) return;
    if (n !== initialName) {
      setBusy(true);
      const { error } = await createClient().rpc("update_my_display_name", {
        p_display_name: n,
      });
      setBusy(false);
      if (error) return setError(error.message);
    }
    next();
  }

  async function saveIban() {
    const v = cleanIban(iban);
    if (!IBAN_RE.test(v)) return setError(t("welcome.ibanInvalid"));
    setBusy(true);
    const { error } = await createClient().rpc("set_my_payout_details", {
      p_iban: v,
      p_payment_note: note.trim() || null,
    });
    setBusy(false);
    if (error) return setError(error.message);
    next();
  }

  function finish(href: string) {
    router.push(href);
    router.refresh();
  }

  const ibanValid = IBAN_RE.test(cleanIban(iban));
  const current = STEPS[step];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col overflow-x-hidden px-4 pb-8 pt-4">
      {/* progress */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(step - 1)}
          aria-label={t("welcome.back")}
          className={`grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2 ${
            step === 0 || current === "done" ? "invisible" : ""
          }`}
        >
          ←
        </button>
        <div className="flex flex-1 gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-primary" : "bg-line"
              }`}
            />
          ))}
        </div>
        <span className="w-9" />
      </div>

      <div key={step} className={`flex flex-1 flex-col ${dir === "next" ? "ob-next" : "ob-prev"}`}>
        {current === "hello" && (
          <Screen
            art={<HelloArt />}
            title={t("welcome.helloTitle")}
            text={t("welcome.helloText")}
          >
            <button type="button" onClick={next} className={primaryBtn}>
              {t("welcome.start")}
            </button>
          </Screen>
        )}

        {current === "how" && (
          <Screen art={null} title={t("welcome.howTitle")}>
            <ol className="mb-auto flex flex-col gap-3 pt-2">
              {(
                [
                  ["🧾", "welcome.how1"],
                  ["➗", "welcome.how2"],
                  ["🤝", "welcome.how3"],
                ] as const
              ).map(([emoji, key], i) => (
                <li
                  key={key}
                  className="ob-rise flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line/60"
                  style={{ animationDelay: `${150 + i * 180}ms` }}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-2xl">
                    {emoji}
                  </span>
                  <span className="font-semibold">{t(key)}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={next} className={`${primaryBtn} mt-6`}>
              {t("welcome.continue")}
            </button>
          </Screen>
        )}

        {current === "name" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
            className="flex flex-1 flex-col"
          >
            <Screen
              art={
                <div className="ob-pop">
                  <Avatar name={name.trim() || "?"} size={96} />
                </div>
              }
              title={t("welcome.nameTitle")}
              text={t("welcome.nameText")}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder={t("welcome.namePlaceholder")}
                className={`${field} mb-3 text-center text-lg font-semibold`}
              />
              {error && <p className="mb-3 text-center text-sm text-neg">{error}</p>}
              <button type="submit" disabled={busy || !name.trim()} className={primaryBtn}>
                {busy ? "…" : t("welcome.continue")}
              </button>
            </Screen>
          </form>
        )}

        {current === "iban" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveIban();
            }}
            className="flex flex-1 flex-col"
          >
            <Screen
              art={<BankCard name={name} iban={iban} valid={ibanValid} />}
              title={t("welcome.ibanTitle")}
              text={t("welcome.ibanText")}
            >
              <input
                autoFocus
                value={groupIban(iban)}
                onChange={(e) => setIban(e.target.value)}
                placeholder="FR76 3000 6000 0112 3456 7890 189"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                aria-label="IBAN"
                className={`${field} mb-2 font-mono`}
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder={t("welcome.notePlaceholder")}
                className={`${field} mb-3 text-sm`}
              />
              {error && <p className="mb-3 text-center text-sm text-neg">{error}</p>}
              <button type="submit" disabled={busy || !iban.trim()} className={primaryBtn}>
                {busy ? "…" : t("welcome.saveIban")}
              </button>
              <button
                type="button"
                onClick={next}
                className="mt-2 w-full py-2 text-sm font-semibold text-muted hover:text-ink"
              >
                {t("welcome.skip")}
              </button>
            </Screen>
          </form>
        )}

        {current === "done" && (
          <Screen
            art={
              <div className="ob-pop grid h-24 w-24 place-items-center rounded-full bg-pos-bg text-5xl text-pos">
                ✓
              </div>
            }
            title={t("welcome.doneTitle", { name: name.trim() })}
            text={t("welcome.doneText")}
          >
            <button type="button" onClick={() => finish("/groups/new")} className={primaryBtn}>
              {t("welcome.createGroup")}
            </button>
            <Link
              href="/balances"
              onClick={(e) => {
                e.preventDefault();
                finish("/balances");
              }}
              className="mt-2 block w-full py-2 text-center text-sm font-semibold text-muted hover:text-ink"
            >
              {t("welcome.later")}
            </Link>
          </Screen>
        )}
      </div>
    </main>
  );
}

function Screen({
  art,
  title,
  text,
  children,
}: {
  art: React.ReactNode;
  title: string;
  text?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {art && <div className="mb-6 flex justify-center pt-2">{art}</div>}
      <h1 className="mb-2 text-center text-2xl font-extrabold tracking-tight">{title}</h1>
      {text && <p className="mb-6 text-center text-muted">{text}</p>}
      {!text && <div className="mb-6" />}
      <div className={`flex flex-1 flex-col ${art === null ? "" : "justify-end"}`}>{children}</div>
    </div>
  );
}

// three friends around a shared bill
function HelloArt() {
  const people = ["Camille", "Léo", "Sam"];
  return (
    <div className="relative h-40 w-56">
      <div className="ob-pop ob-float absolute left-1/2 top-6 -ml-12 grid h-24 w-24 place-items-center rounded-3xl bg-primary text-5xl shadow-lg">
        🧾
      </div>
      {people.map((p, i) => (
        <div
          key={p}
          className="ob-pop absolute"
          style={{
            animationDelay: `${250 + i * 150}ms`,
            left: ["0%", "40%", "78%"][i],
            top: ["58%", "76%", "58%"][i],
          }}
        >
          <Avatar name={p} size={44} ring />
        </div>
      ))}
    </div>
  );
}

// a card that fills in live while you type the IBAN
function BankCard({ name, iban, valid }: { name: string; iban: string; valid: boolean }) {
  const shown = groupIban(iban) || "•••• •••• •••• •••• ••••";
  return (
    <div className="ob-pop relative aspect-[1.6] w-full max-w-[18rem] overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#b4791f] p-5 text-white shadow-xl">
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="absolute -bottom-14 -left-8 h-40 w-40 rounded-full bg-white/10" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="h-7 w-10 rounded-md bg-white/70" />
          <span
            className={`grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-bold text-pos transition-all duration-300 ${
              valid ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            ✓
          </span>
        </div>
        <p className="font-mono text-[15px] leading-snug tracking-wide">{shown}</p>
        <p className="truncate text-sm font-semibold uppercase opacity-90">{name.trim() || "—"}</p>
      </div>
    </div>
  );
}
