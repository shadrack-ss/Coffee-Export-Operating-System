import { describe, it, expect } from "vitest";
import { computeProcessing } from "../processing";

describe("computeProcessing", () => {
  it("spec example: 1000 kg in → 850 kg out = 85% yield, 150 kg loss", () => {
    const result = computeProcessing(1000, 850, 8_500_000);

    expect(result.yield_pct).toBe(85);
    expect(result.loss_kg).toBe(150);
  });

  it("true cost per kg = total accumulated cost ÷ clean output kg", () => {
    // 8 500 000 UGX ÷ 850 kg = 10 000 UGX/kg exactly
    const result = computeProcessing(1000, 850, 8_500_000);
    expect(result.true_cost_per_kg_clean).toBe(10_000);
  });

  it("rounds true cost to whole UGX/kg", () => {
    // 1 000 001 UGX ÷ 850 kg ≈ 1176.47 → rounds to 1176
    const result = computeProcessing(1000, 850, 1_000_001);
    expect(Number.isInteger(result.true_cost_per_kg_clean)).toBe(true);
    expect(result.true_cost_per_kg_clean).toBe(1176);
  });

  it("100% yield when input equals output", () => {
    const result = computeProcessing(500, 500, 5_000_000);
    expect(result.yield_pct).toBe(100);
    expect(result.loss_kg).toBe(0);
  });

  it("returns 0 true cost when output is 0 (no divide-by-zero)", () => {
    const result = computeProcessing(1000, 0, 5_000_000);
    expect(result.true_cost_per_kg_clean).toBe(0);
    expect(result.yield_pct).toBe(0);
  });

  it("returns 0 yield when input is 0", () => {
    const result = computeProcessing(0, 0, 0);
    expect(result.yield_pct).toBe(0);
  });

  it("weights are rounded to 3 decimal places", () => {
    const result = computeProcessing(1000.333, 850.777, 0);
    // roundKg = Math.round(x * 1000) / 1000
    expect(result.input_kg).toBe(1000.333);
    expect(result.output_kg).toBe(850.777);
    expect(result.loss_kg).toBe(
      Math.round((1000.333 - 850.777) * 1000) / 1000,
    );
  });
});
