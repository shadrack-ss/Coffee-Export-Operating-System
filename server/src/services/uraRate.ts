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

    // Block images/fonts/media to speed up page load
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (type === "image" || type === "font" || type === "media") {
        req.abort();
      } else {
        req.continue();
      }
    });

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

    // Click search and wait for DataTable to repopulate (event-driven, not fixed sleep)
    await page.click('button[name="submit_search"]');
    await page
      .waitForFunction(
        () => {
          const rows = document.querySelectorAll("table tbody tr");
          // DataTables shows a single "No data" row while loading — wait until
          // there are real data rows or we've waited long enough.
          if (rows.length === 0) return false;
          const firstCell = rows[0]?.querySelector("td")?.textContent?.trim() ?? "";
          return firstCell.length > 0 && firstCell !== "No data available in table";
        },
        { timeout: 15_000 },
      )
      .catch(() => {
        // Timed out waiting — fall through to extraction (table may be empty)
      });

    // Extract rate + capture debug snapshot
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

        // Strategy 2: any cell contains "USD" and any cell contains "exports"
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
      return {
        ok: false,
        error: "Rate not found in URA table — page structure may have changed.",
        debug: JSON.stringify(result.snapshot),
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
