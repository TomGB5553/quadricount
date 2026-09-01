import { CURRENCIES } from "@/lib/currencies";
import type { ParsedReceipt, ReceiptItem } from "./types";

// --- provider ----------------------------------------------------------------
// Right now this talks to Google's Gemini API (it has a genuinely free tier).
// Everything provider-specific lives in this file — swapping to Groq / OpenAI /
// Claude means rewriting only `callModel` and keeping the same return shape.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

export function receiptScanConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

const PROMPT = `You are reading a photo of a shop or restaurant receipt.
It may be in French, English or Portuguese. Extract what was bought.

Rules:
- "items": one entry per line item actually purchased. "name" is a short human label
  (translate obvious abbreviations, keep it in the original language otherwise).
  "qty" is the number of units (default 1). "total" is the amount charged for that
  whole line, as a decimal number in the receipt's currency.
- Do NOT include subtotal, tax, tip, discount or total lines as items.
- "tax": total VAT / TVA / IVA / sales tax shown. 0 if none shown.
- "tip": service charge or gratuity. 0 if none.
- "discount": total of any discounts / loyalty reductions, as a positive number. 0 if none.
- "total": the final grand total actually paid.
- "taxIncluded": true if the listed item prices already include tax (usual in France
  and Portugal), false if tax is added on top of them (usual in the US).
- "currency": 3-letter ISO code (EUR, USD, GBP, BRL, ...). Guess from currency symbols
  or language if not written.
- "date": purchase date as YYYY-MM-DD, or null.
- "merchant": shop / restaurant name, or null.
Return ONLY the JSON.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    merchant: { type: "string", nullable: true },
    date: { type: "string", nullable: true },
    currency: { type: "string" },
    taxIncluded: { type: "boolean" },
    tax: { type: "number" },
    tip: { type: "number" },
    discount: { type: "number" },
    total: { type: "number" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          qty: { type: "number" },
          total: { type: "number" },
        },
        required: ["name", "qty", "total"],
      },
    },
  },
  required: ["currency", "taxIncluded", "tax", "tip", "discount", "total", "items"],
};

type RawItem = { name?: unknown; qty?: unknown; total?: unknown };
type RawReceipt = {
  merchant?: unknown;
  date?: unknown;
  currency?: unknown;
  taxIncluded?: unknown;
  tax?: unknown;
  tip?: unknown;
  discount?: unknown;
  total?: unknown;
  items?: unknown;
};

async function callModel(
  imageBase64: string,
  mimeType: string,
): Promise<RawReceipt> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const res = await fetch(ENDPOINT(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Model returned no text");
  return JSON.parse(text) as RawReceipt;
}

// --- normalisation ----------------------------------------------------------

const toMinor = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) : 0;
};

function cleanCurrency(v: unknown, fallback: string): string {
  const code = String(v ?? "").trim().toUpperCase();
  return (CURRENCIES as readonly string[]).includes(code) ? code : fallback;
}

function cleanItems(v: unknown): ReceiptItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((raw: RawItem): ReceiptItem => {
      const qty = Math.max(1, Math.round(Number(raw?.qty) || 1));
      return {
        name: String(raw?.name ?? "Item").trim().slice(0, 120) || "Item",
        qty,
        total: toMinor(raw?.total),
      };
    })
    .filter((it) => it.total > 0);
}

export async function extractReceipt(
  imageBase64: string,
  mimeType: string,
  fallbackCurrency: string,
): Promise<ParsedReceipt> {
  const raw = await callModel(imageBase64, mimeType);

  const items = cleanItems(raw.items);
  const itemsSum = items.reduce((s, it) => s + it.total, 0);
  const total = toMinor(raw.total) || itemsSum;

  const dateStr = String(raw.date ?? "");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : null;

  return {
    merchant: raw.merchant ? String(raw.merchant).trim().slice(0, 120) : null,
    date,
    currency: cleanCurrency(raw.currency, fallbackCurrency),
    items,
    tax: toMinor(raw.tax),
    tip: toMinor(raw.tip),
    discount: toMinor(raw.discount),
    total,
    taxIncluded: raw.taxIncluded !== false,
  };
}
