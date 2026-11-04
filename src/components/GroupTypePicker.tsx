"use client";

import { useState } from "react";
import { GROUP_TYPES, type GroupType } from "@/lib/categories";
import { useT } from "@/lib/i18n/client";

// Row of small emoji chips; tap again to unselect. Optional by design.
export default function GroupTypePicker({
  value,
  onChange,
  name,
}: {
  value: GroupType | null;
  onChange: (v: GroupType | null) => void;
  name?: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-1.5">
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      {(Object.keys(GROUP_TYPES) as GroupType[]).map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(value === k ? null : k)}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            value === k
              ? "border-primary bg-primary text-primary-ink"
              : "border-line text-muted hover:text-ink"
          }`}
        >
          {GROUP_TYPES[k].emoji} {t(`gtype.${k}`)}
        </button>
      ))}
    </div>
  );
}

// Uncontrolled version for plain server-action forms.
export function GroupTypeField({ name }: { name: string }) {
  const [value, setValue] = useState<GroupType | null>(null);
  return <GroupTypePicker name={name} value={value} onChange={setValue} />;
}
