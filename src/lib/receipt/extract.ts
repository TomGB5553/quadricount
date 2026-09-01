import { CURRENCIES } from "@/lib/currencies";
import type { ParsedReceipt, ReceiptItem } from "./types";

// --- providers ---------------------------------------------------------------
// Two interchangeable free vision APIs. Groq (Llama 4) is tried first when its
// key is set — it's currently far less congested than Gemini's free tier, which
// hands out 503 "high demand" under load. Whichever keys are present are used.
// Adding another provider = one more `call*` function + a line in `attempts`.

const GROQ_MODELS = [
  process.env.GROQ_MODEL,
  "qwen/qwen3.6-27b",
  "qwen/qwen3.8-27b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
].filter((m): m is string => !!m);

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
].filter((m): m is string => !!m);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function receiptScanConfigured(): boolean {
  return !!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);
}

export class ReceiptScanError extends Error {
  status?: number;
}

function extractJson(text: string): RawReceipt {
  // Models occasionally wrap the JSON in ``` fences or add a stray prefix.
  const cleaned = text
    .replace(/^[^{[]*/, "")
    .replace(/[^}\]]*$/, "");
  return JSON.parse(cleaned || text) as RawReceipt;
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

function fail(label: string, status: number | undefined, msg: string) {
  const e = new ReceiptScanError(`${label}: ${status ?? ""} ${msg}`.trim());
  e.status = status;
  return e;
}

async function callGemini(
  model: string,
  key: string,
  imageBase64: string,
  mimeType: string,
): Promise<RawReceipt> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
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
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    },
  );

  const bodyText = await res.text();
  if (!res.ok) {
    let msg = bodyText.slice(0, 200);
    try {
      msg = JSON.parse(bodyText)?.error?.message ?? msg;
    } catch {}
    throw fail(`gemini/${model}`, res.status, msg);
  }

  const data = JSON.parse(bodyText);
  const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw fail(
      `gemini/${model}`,
      undefined,
      data?.promptFeedback?.blockReason ?? "no text in response",
    );
  }
  return extractJson(text);
}

async function callGroq(
  model: string,
  key: string,
  imageBase64: string,
  mimeType: string,
): Promise<RawReceipt> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    let msg = bodyText.slice(0, 200);
    try {
      msg = JSON.parse(bodyText)?.error?.message ?? msg;
    } catch {}
    throw fail(`groq/${model}`, res.status, msg);
  }

  const content: unknown = JSON.parse(bodyText)?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw fail(`groq/${model}`, undefined, "no text in response");
  }
  return extractJson(content);
}

async function callModel(
  imageBase64: string,
  mimeType: string,
): Promise<RawReceipt> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const attempts: (() => Promise<RawReceipt>)[] = [
    ...(groqKey
      ? GROQ_MODELS.map(
          (m) => () => callGroq(m, groqKey, imageBase64, mimeType),
        )
      : []),
    ...(geminiKey
      ? GEMINI_MODELS.map(
          (m) => () => callGemini(m, geminiKey, imageBase64, mimeType),
        )
      : []),
  ];
  if (attempts.length === 0)
    throw new ReceiptScanError("No GROQ_API_KEY or GEMINI_API_KEY set");

  const errors: string[] = [];
  for (const run of attempts) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await run();
      } catch (err) {
        const status = err instanceof ReceiptScanError ? err.status : undefined;
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt === 1 || !(status === 503 || status === 429 || status === 500))
          errors.push(msg);

        // Overloaded / rate-limited / hiccup: wait, retry once, then move on.
        if (status === 503 || status === 429 || status === 500) {
          if (attempt === 0) {
            await sleep(1500);
            continue;
          }
          break;
        }
        // Dead model name -> next model.
        if (/not found|404|is not supported|does not exist|decommission/i.test(msg))
          break;
        // Bad key, safety block, malformed request, parse error: unrecoverable.
        throw err;
      }
    }
  }
  // Nothing worked — report what each provider said (deduped).
  throw new ReceiptScanError([...new Set(errors)].join(" | ") || "receipt scan failed");
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
