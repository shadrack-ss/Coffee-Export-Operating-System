import { describe, it, expect } from "vitest";
import { computeProfitability } from "../forex";

const baseInput = {
  selling_price_usd_per_kg: 2.5,
  usd_ugx_rate: 3800,
  quantity_kg: 1000,
  total_landed_cost: 8_000_000,
  aob_expenses: 0,
  target_margin_pct: 10,
};

describe("computeProfitability", () => {
  it("revenue = selling_usd × rate × quantity, rounded to integer", () => {
    const result = computeProfitability(baseInput);
    // 2.5 × 3800 × 1000 = 9 500 000
    expect(result.revenue_ugx).toBe(9_500_000);
    expect(Number.isInteger(result.revenue_ugx)).toBe(true);
  });

  it("profit = revenue − landed_cost − aob_expenses", () => {
    const result = computeProfitability(baseInput);
    // 9 500 000 − 8 000 000 = 1 500 000
    expect(result.profit_loss_ugx).toBe(1_500_000);
  });

  it("margin = profit / revenue × 100, rounded to 2 dp", () => {
    const result = computeProfitability(baseInput);
    // (1 500 000 / 9 500 000) × 100 ≈ 15.789 → 15.79
    expect(result.margin_pct).toBe(15.79);
  });

  it("includes aob_expenses in total cost", () => {
    const result = computeProfitability({ ...baseInput, aob_expenses: 500_000 });
    // profit = 9 500 000 − 8 000 000 − 500 000 = 1 000 000
    expect(result.profit_loss_ugx).toBe(1_000_000);
  });

  it("breakeven_usd_per_kg = total_cost / (rate × qty), 4 dp precision", () => {
    const result = computeProfitability(baseInput);
    // 8 000 000 / (3800 × 1000) = 2.1052... → stored at 4dp = 2.1053
    expect(result.breakeven_usd_per_kg).toBe(2.1053);
  });

  it("rate_for_target_margin: rate needed to hit target%, rounded to integer", () => {
    const result = computeProfitability(baseInput);
    // target_revenue = 8 000 000 / (1 − 0.10) = 8 888 888.88
    // usd_revenue = 2.5 × 1000 = 2500
    // rate_needed = Math.round(8 888 888.88 / 2500) = 3556
    expect(result.rate_for_target_margin).toBe(3556);
    expect(Number.isInteger(result.rate_for_target_margin)).toBe(true);
  });

  describe("risk levels", () => {
    it("safe: profit > 0 and live rate ≥ rate_for_target", () => {
      // rate 3800 ≥ 3556, profit 1 500 000 > 0
      const result = computeProfitability(baseInput);
      expect(result.risk).toBe("safe");
    });

    it("watch: profit > 0 but live rate < rate_for_target", () => {
      // rate 3400 < 3556
      // revenue = 2.5 × 3400 × 1000 = 8 500 000; profit = 500 000 > 0
      const result = computeProfitability({ ...baseInput, usd_ugx_rate: 3400 });
      expect(result.risk).toBe("watch");
      expect(result.profit_loss_ugx).toBeGreaterThan(0);
    });

    it("risk: profit is negative", () => {
      // rate 3000: revenue = 7 500 000; profit = −500 000 < 0
      const result = computeProfitability({ ...baseInput, usd_ugx_rate: 3000 });
      expect(result.risk).toBe("risk");
      expect(result.profit_loss_ugx).toBeLessThan(0);
    });
  });

  it("margin_pct is 0 when revenue is 0", () => {
    const result = computeProfitability({
      ...baseInput,
      selling_price_usd_per_kg: 0,
    });
    expect(result.margin_pct).toBe(0);
  });

  it("rate_for_target_margin is 0 when no USD revenue", () => {
    const result = computeProfitability({
      ...baseInput,
      selling_price_usd_per_kg: 0,
    });
    expect(result.rate_for_target_margin).toBe(0);
  });
});
