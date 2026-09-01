"use client";

import { useFormStatus } from "react-dom";

// A submit button that shows a pending state while its <form>'s action runs.
// Must be rendered inside the <form> (not as the form component itself).
export default function SubmitButton({
  children,
  className = "rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50",
  pendingText,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={className}
    >
      {pending ? (pendingText ?? "En cours…") : children}
    </button>
  );
}
