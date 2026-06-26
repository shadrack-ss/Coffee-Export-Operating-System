/*
 * Shared Puppeteer browser singleton.
 * Must be a static import (not dynamic) — a dynamic import of puppeteer's
 * large CJS tree blocks the event loop under tsx and never resolves.
 */
import puppeteer, { type Browser } from "puppeteer";

let browserPromise: Promise<Browser> | null = null;

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    }).then(
      (browser) => {
        browser.on("disconnected", () => { browserPromise = null; });
        return browser;
      },
      (err) => {
        browserPromise = null;
        throw err;
      },
    );
  }
  return browserPromise;
}
