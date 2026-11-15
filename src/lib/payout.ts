// Ways a person can be paid back (see payout_methods table).
export type PayoutKind = "iban" | "revolut" | "wero";
export type PayoutMethod = { kind: PayoutKind; value: string; label: string | null };
export type Payout = { methods: PayoutMethod[]; note: string | null };

type MethodRow = PayoutMethod & { user_id: string; position: number };
type NoteRow = { user_id: string; payment_note: string | null };

// Group rows by user_id; users with nothing at all are left out.
export function buildPayouts(
  methods: MethodRow[] | null,
  notes: NoteRow[] | null,
): Record<string, Payout> {
  const out: Record<string, Payout> = {};
  for (const m of [...(methods ?? [])].sort((a, b) => a.position - b.position)) {
    (out[m.user_id] ??= { methods: [], note: null }).methods.push({
      kind: m.kind,
      value: m.value,
      label: m.label,
    });
  }
  for (const n of notes ?? []) {
    if (n.payment_note) (out[n.user_id] ??= { methods: [], note: null }).note = n.payment_note;
  }
  return out;
}

// "FR76 3000 6000 ..." for display
export function formatIban(v: string) {
  return v.replace(/(.{4})/g, "$1 ").trim();
}
