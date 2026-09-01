// Shape of a receipt after the vision model has read it.
// All money is in integer minor units (cents), same as the rest of the app.

export type ReceiptItem = {
  name: string;
  qty: number; // whole units, at least 1
  total: number; // line total (what was actually charged for this line), > 0
};

export type ParsedReceipt = {
  merchant: string | null;
  date: string | null; // YYYY-MM-DD, or null if not found
  currency: string; // ISO 4217, always one of CURRENCIES
  items: ReceiptItem[];
  tax: number; // >= 0 — VAT / sales tax printed on the receipt
  tip: number; // >= 0 — service / gratuity
  discount: number; // >= 0 — a positive amount that was subtracted
  total: number; // the grand total printed on the receipt, > 0
  taxIncluded: boolean; // true when item prices already include tax (typical in FR / PT)
};
