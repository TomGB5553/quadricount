import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractReceipt, receiptScanConfigured } from "@/lib/receipt/extract";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

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
