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
}

let inFlight: Promise<UraRateResult> | null = null;

export function fetchUraExportsRate(forDate?: Date): Promise<UraRateResult> {
  // If a scrape is already running, piggyback on it rather than starting a second one.
  if (inFlight) return inFlight;
  inFlight = scrape(forDate).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function scrape(forDate?: Date): Promise<UraRateResult> {
  const target = forDate ?? new Date();
  const dateStr = target.toISOString().slice(0, 10); // YYYY-MM-DD for native date input

  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.goto(URA_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Select "Exports" radio (id=rate-type-2)
    await page.click("#rate-type-2");

    // Narrow to USD only
    await page.select("#currency_code", "USD");

    // Ensure "A day" search mode
    await page.select("#search_criteria", "date");

    // Set the date (type=date expects YYYY-MM-DD)
    await page.evaluate((d: string) => {
      const inp = document.querySelector<HTMLInputElement>("#search_date");
      if (inp) {
        inp.value = d;
        inp.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, dateStr);

    // Click Search — type="button" with name="submit_search", results are AJAX
    await page.click('button[name="submit_search"]');

    // Wait for the DataTable to repopulate
    await new Promise((r) => setTimeout(r, 4_000));

    // Extract rate — table row: [Exports, US DOLLAR, USD, date, rate]
    const rate = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td")).map(
          (td) => td.textContent?.trim() ?? "",
        );
        const isExports = cells[0]?.toLowerCase() === "exports";
        const isUsd = cells[2]?.toUpperCase() === "USD";
        if (isExports && isUsd) {
          const v = parseFloat(cells[cells.length - 1].replace(/,/g, ""));
          if (Number.isFinite(v) && v > 100) return v;
        }
      }
      return null;
    });

    if (!rate) {
      return {
        ok: false,
        error: "Rate not found in URA table — page structure may have changed.",
      };
    }

    return { ok: true, rate, date: dateStr };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error scraping URA",
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}
