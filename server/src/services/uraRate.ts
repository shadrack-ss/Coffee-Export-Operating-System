/*
 * Scrapes today's USD/UGX Exports rate from the URA exchange-rates page.
 * Uses Puppeteer (shared browser singleton) to drive the form.
 * The Search button is type="button" (not submit), results load via AJAX.
 *
 * Only one scrape runs at a time — concurrent callers share the in-flight
 * promise instead of launching a second Chrome session (which can crash it).
 */
import type { Page } from "puppeteer";
import { getBrowser } from "./browser.ts";

const URA_URL = "https://www.ura.go.ug/en/exchange-rates/";

export interface UraRateResult {
  ok: boolean;
  rate?: number;
  date?: string;
  error?: string;
  debug?: string;
}

let inFlight: Promise<UraRateResult> | null = null;

export function fetchUraExportsRate(forDate?: Date): Promise<UraRateResult> {
  if (inFlight) return inFlight;
  inFlight = scrape(forDate).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function scrape(forDate?: Date): Promise<UraRateResult> {
  const target = forDate ?? new Date();
  const dateStr = target.toISOString().slice(0, 10);

  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.goto(URA_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    await page.click("#rate-type-2");
    await page.select("#currency_code", "USD");
    await page.select("#search_criteria", "date");

    await page.evaluate((d: string) => {
      const inp = document.querySelector<HTMLInputElement>("#search_date");
      if (inp) {
        inp.value = d;
        inp.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, dateStr);

    await page.click('button[name="submit_search"]');

    // Wait for AJAX — give up to 8 s for slower servers
    await new Promise((r) => setTimeout(r, 8_000));

    // Capture table content for diagnostics + extract rate
    const result = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const snapshot = rows.slice(0, 6).map((r) =>
        Array.from(r.querySelectorAll("td")).map((td) => td.textContent?.trim() ?? ""),
      );

      let rate: number | null = null;

      for (const cells of snapshot) {
        // Strategy 1: exact column positions [Exports, currency_name, USD, date, rate]
        const isExports = cells[0]?.toLowerCase() === "exports";
        const isUsd = cells[2]?.toUpperCase() === "USD";
        if (isExports && isUsd) {
          const v = parseFloat(cells[cells.length - 1].replace(/,/g, ""));
          if (Number.isFinite(v) && v > 100) { rate = v; break; }
        }

        // Strategy 2: any cell contains "USD" and any cell looks like a UGX rate
        const hasUsd = cells.some((c) => c.toUpperCase() === "USD");
        const hasExports = cells.some((c) => c.toLowerCase() === "exports");
        if (hasUsd && hasExports) {
          for (const c of [...cells].reverse()) {
            const v = parseFloat(c.replace(/,/g, ""));
            if (Number.isFinite(v) && v > 1000 && v < 100_000) { rate = v; break; }
          }
          if (rate) break;
        }
      }

      return { rate, snapshot };
    });

    if (!result.rate) {
      const debug = JSON.stringify(result.snapshot);
      return {
        ok: false,
        error: "Rate not found in URA table — page structure may have changed.",
        debug,
      };
    }

    return { ok: true, rate: result.rate, date: dateStr };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error scraping URA",
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}
