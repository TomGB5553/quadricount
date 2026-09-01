import { CURRENCIES } from "@/lib/currencies";
import type { ParsedReceipt, ReceiptItem } from "./types";

// --- provider ----------------------------------------------------------------
// Right now this talks to Google's Gemini API (it has a genuinely free tier).
// Everything provider-specific lives in this file — swapping to Groq / OpenAI /
// Claude means rewriting only `callModel` and keeping the same return shape.

// Tried in order until one works — model names drift and vary by key/region.
const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
].filter((m): m is string => !!m);

const endpoint = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

export function receiptScanConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export class ReceiptScanError extends Error {}

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
Return ONLY a JSON object with keys:
{ "merchant": string|null, "date": "YYYY-MM-DD"|null, "currency": string,
  "taxIncluded": boolean, "tax": number, "tip": number, "discount": number,
  "total": number,
  "items": [ { "name": string, "qty": number, "total": number } ] }`;

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

async function callOneModel(
  model: string,
  key: string,
  imageBase64: string,
  mimeType: string,
): Promise<RawReceipt> {
  const res = await fetch(endpoint(model, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    let msg = bodyText.slice(0, 200);
    try {
      msg = JSON.parse(bodyText)?.error?.message ?? msg;
    } catch {}
    throw new ReceiptScanError(`${model}: ${res.status} ${msg}`);
  }

  const data = JSON.parse(bodyText);
  const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    const reason = data?.promptFeedback?.blockReason ?? "no text in response";
    throw new ReceiptScanError(`${model}: ${reason}`);
  }
  // The model sometimes wraps JSON in ```json fences despite instructions.
  const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  return JSON.parse(json) as RawReceipt;
}

async function callModel(
  imageBase64: string,
  mimeType: string,
): Promise<RawReceipt> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ReceiptScanError("GEMINI_API_KEY is not set");

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      return await callOneModel(model, key, imageBase64, mimeType);
    } catch (err) {
      lastErr = err;
      const m = err instanceof Error ? err.message : String(err);
      // A 404 / "not found" means this model name is dead — try the next one.
      // Anything else (bad key, quota, safety block, parse) won't be fixed by
      // another model, so stop and report it.
      if (!/not found|404|is not supported|does not exist/i.test(m)) break;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new ReceiptScanError("receipt scan failed");
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
