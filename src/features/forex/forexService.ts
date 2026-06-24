/*
 * USD/UGX feed service.
 *
 * Uses the free, key-less ExchangeRate-API open endpoint. For the keyed plan,
 * read the key from an env var (VITE_EXCHANGERATE_API_KEY) — never hardcode it —
 * and switch to the v6/<key>/latest/USD URL. The feed ALWAYS degrades gracefully:
 * on any failure callers fall back to the last snapshot or a manual override
 * (§8 — forex must keep working when the feed is down).
 */

export interface RateFetch {
  ok: boolean;
  rate?: number;
  source: string;
  error?: string;
}

const OPEN_ENDPOINT = "https://open.er-api.com/v6/latest/USD";

export async function fetchUsdUgx(
  signal?: AbortSignal,
): Promise<RateFetch> {
  try {
    const res = await fetch(OPEN_ENDPOINT, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    const rate = data.rates?.UGX;
    if (data.result !== "success" || !rate || !Number.isFinite(rate)) {
      throw new Error("UGX rate missing from feed");
    }
    return { ok: true, rate, source: "ExchangeRate-API" };
  } catch (err) {
    return {
      ok: false,
      source: "ExchangeRate-API",
      error: err instanceof Error ? err.message : "feed unavailable",
    };
  }
}
