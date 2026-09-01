"use client";

import { useFormStatus } from "react-dom";

// A submit button that asks for confirmation first. Use inside a <form action>.
export default function ConfirmSubmit({
  children,
  confirm,
  className = "text-xs text-muted hover:text-neg disabled:opacity-50",
  pendingText = "…",
}: {
  children: React.ReactNode;
  confirm: string;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className={className}
    >
      {pending ? pendingText : children}
    </button>
  );
}
