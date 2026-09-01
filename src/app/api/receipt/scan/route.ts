import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractReceipt, receiptScanConfigured } from "@/lib/receipt/extract";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

// GET /api/receipt/scan?models=1 -> which Gemini models this key can use.
// A quick diagnostic; safe to remove later.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "No GEMINI_API_KEY." }, { status: 501 });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
  );
  const data = await res.json();
  const models = Array.isArray(data?.models)
    ? data.models
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          m.supportedGenerationMethods?.includes("generateContent"),
        )
        .map((m: { name?: string }) => m.name)
    : data;
  return NextResponse.json({ status: res.status, models });
}

// Reads a receipt photo with a vision model and returns structured line items.
// The image is never stored — it's held in memory only for the model call.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!receiptScanConfigured()) {
    return NextResponse.json(
      { error: "Receipt scanning isn't configured on this server." },
      { status: 501 },
    );
  }

  const form = await request.formData();
  const file = form.get("image");
  const fallbackCurrency = String(form.get("currency") ?? "EUR");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That image is too large (max 8 MB)." },
      { status: 413 },
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const receipt = await extractReceipt(
      base64,
      file.type || "image/jpeg",
      fallbackCurrency,
    );
    return NextResponse.json({ receipt });
  } catch (err) {
    console.error("[receipt/scan]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Couldn't read that receipt. Try a clearer, straighter photo.",
        detail,
      },
      { status: 502 },
    );
  }
}
