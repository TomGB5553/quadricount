import { createClient } from "@/lib/supabase/server";

// How many units of `to` currency equal one unit of `from`, on `date`.
// Used to lock an expense/payment's conversion rate at entry time.
//
// Source: Frankfurter (free, no key, ECB reference rates, historical by date).
// Only ~30 major currencies are covered; anything else falls back to 1 and the
// user can correct the stored rate later.
export async function getFxRate(
  from: string,
  to: string,
  date: string,
): Promise<number> {
  if (from === to) return 1;

  const supabase = await createClient();

  const { data: cached } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base_currency", from)
    .eq("quote_currency", to)
    .eq("as_of_date", date)
    .maybeSingle();
  if (cached?.rate) return Number(cached.rate);

  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/${date}?base=${from}&symbols=${to}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      console.warn(`fx: no rate for ${from}->${to} on ${date} (HTTP ${res.status}); using 1`);
      return 1;
    }
    const json = (await res.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const rate = json.rates?.[to];
    if (typeof rate !== "number" || !(rate > 0)) {
      console.warn(`fx: unexpected response for ${from}->${to}; using 1`);
      return 1;
    }

    await supabase.from("exchange_rates").upsert({
      base_currency: from,
      quote_currency: to,
      as_of_date: date,
      rate,
      source: "frankfurter",
      fetched_at: new Date().toISOString(),
    });
    return rate;
  } catch {
    return 1;
  }
}
