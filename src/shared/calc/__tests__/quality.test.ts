import { describe, it, expect } from "vitest";
import { computeQuality, recommendGrade } from "../quality";
import type { Settings } from "../../types";

const baseSettings: Settings = {
  mc_standard_pct: 14,
  fm_standard_pct: 0.5,
  defect_standard_pct: 5,
  default_defect_handling: "weight",
  fm_base: "net_physical",
  ura_tax_pct: 2,
  handling_per_kg: 100,
  gunny_bags_per_kg: 109,
  gunny_bags_usd_ref_rate: 3600,
  paperwork_per_kg: 50,
  target_margin_pct: 10,
  coffee_grades: [],
  districts: [],
  expense_categories: [],
};

describe("computeQuality", () => {
  it("spec example: 1000 kg net @ 20% MC with 14% standard → 940 kg", () => {
    const result = computeQuality(
      {
        gross_weight_kg: 1000,
        tare_weight_kg: 0,
        moisture_pct: 20,
        fallen_matter_pct: 0,
        defect_pct: 0,
        defect_handling_mode: "weight",
        market_price_per_kg: 7400,
      },
      baseSettings,
    );

    expect(result.mc_deduction_pct).toBe(6);
    expect(result.net_payable_weight_kg).toBe(940);
    expect(result.effective_price_per_kg).toBe(7400);
    expect(result.amount_paid_to_farmer).toBe(6_956_000);
  });

  it("no MC deduction when moisture is below standard", () => {
    const result = computeQuality(
      {
        gross_weight_kg: 1000,
        tare_weight_kg: 0,
        moisture_pct: 10,
        fallen_matter_pct: 0,
        defect_pct: 0,
        defect_handling_mode: "weight",
        market_price_per_kg: 7400,
      },
      baseSettings,
    );

    expect(result.mc_deduction_pct).toBe(0);
    expect(result.net_payable_weight_kg).toBe(1000);
  });

  it("tare weight is subtracted before all deductions", () => {
    const result = computeQuality(
      {
        gross_weight_kg: 1000,
        tare_weight_kg: 60,
        moisture_pct: 14,
        fallen_matter_pct: 0,
        defect_pct: 0,
        defect_handling_mode: "weight",
        market_price_per_kg: 7400,
      },
      baseSettings,
    );

    expect(result.net_physical_kg).toBe(940);
    expect(result.net_payable_weight_kg).toBe(940);
  });

  it("FM deduction uses net_physical when fm_base is net_physical", () => {
    // moisture = standard → no MC deduction; FM = 2% off 1000 kg = 20 kg
    const result = computeQuality(
      {
        gross_weight_kg: 1000,
        tare_weight_kg: 0,
        moisture_pct: 14,
        fallen_matter_pct: 2,
        defect_pct: 0,
        defect_handling_mode: "weight",
        market_price_per_kg: 7400,
      },
      { ...baseSettings, fm_base: "net_physical" },
    );

    expect(result.fm_deduction_kg).toBe(20);
    expect(result.net_payable_weight_kg).toBe(980);
  });

  it("FM deduction uses moisture-adjusted weight when fm_base is after_mc", () => {
    // MC deduction: 6% → weight_after_mc = 940; FM 2% of 940 = 18.8 kg
    const result = computeQuality(
      {
        gross_weight_kg: 1000,
        tare_weight_kg: 0,
        moisture_pct: 20,
        fallen_matter_pct: 2,
        defect_pct: 0,
        defect_handling_mode: "weight",
        market_price_per_kg: 7400,
      },
      { ...baseSettings, fm_base: "after_mc" },
    );

    expect(result.fm_deduction_kg).toBe(18.8);
    expect(result.net_payable_weight_kg).toBe(921.2);
  });

  it("defect weight mode deducts excess above standard from weight", () => {
    // defect=8%, standard=5%, excess=3% → weight × 0.97
    const result = computeQuality(
      {
        gross_weight_kg: 100,
        tare_weight_kg: 0,
        moisture_pct: 14,
        fallen_matter_pct: 0,
        defect_pct: 8,
        defect_handling_mode: "weight",
        market_price_per_kg: 7400,
      },
      baseSettings,
    );

    expect(result.defect_excess_pct).toBe(3);
    expect(result.net_payable_weight_kg).toBe(97);
    expect(result.price_discount_pct).toBe(0);
  });

  it("defect discount mode reduces price, weight unchanged", () => {
    // defect=8%, excess=3% → price × 0.97 = 7178, weight stays 100
    const result = computeQuality(
      {
        gross_weight_kg: 100,
        tare_weight_kg: 0,
        moisture_pct: 14,
        fallen_matter_pct: 0,
        defect_pct: 8,
        defect_handling_mode: "discount",
        market_price_per_kg: 7400,
      },
      baseSettings,
    );

    expect(result.defect_excess_pct).toBe(3);
    expect(result.price_discount_pct).toBe(3);
    expect(result.net_payable_weight_kg).toBe(100);
    expect(result.effective_price_per_kg).toBe(7178);
    expect(result.amount_paid_to_farmer).toBe(717_800);
  });

  it("defects within standard produce no deduction", () => {
    const result = computeQuality(
      {
        gross_weight_kg: 100,
        tare_weight_kg: 0,
        moisture_pct: 14,
        fallen_matter_pct: 0,
        defect_pct: 3,
        defect_handling_mode: "weight",
        market_price_per_kg: 7400,
      },
      baseSettings,
    );

    expect(result.defect_excess_pct).toBe(0);
    expect(result.net_payable_weight_kg).toBe(100);
    expect(result.steps.find((s) => s.key === "after_defects")?.delta_kg).toBe(0);
  });

  it("derivation steps count and keys are stable", () => {
    const result = computeQuality(
      {
        gross_weight_kg: 1000,
        tare_weight_kg: 0,
        moisture_pct: 20,
        fallen_matter_pct: 2,
        defect_pct: 8,
        defect_handling_mode: "weight",
        market_price_per_kg: 7400,
      },
      baseSettings,
    );

    const keys = result.steps.map((s) => s.key);
    expect(keys).toEqual(["net_physical", "after_mc", "after_fm", "after_defects"]);
  });

  it("amount paid is always an integer", () => {
    const result = computeQuality(
      {
        gross_weight_kg: 753,
        tare_weight_kg: 23,
        moisture_pct: 17,
        fallen_matter_pct: 1.5,
        defect_pct: 6,
        defect_handling_mode: "weight",
        market_price_per_kg: 7350,
      },
      baseSettings,
    );

    expect(Number.isInteger(result.amount_paid_to_farmer)).toBe(true);
    expect(Number.isInteger(result.effective_price_per_kg)).toBe(true);
  });
});

describe("recommendGrade", () => {
  it("Screen 18 (AA) for moisture ≤ 13 and defect ≤ 3", () => {
    expect(recommendGrade(13, 3)).toBe("Screen 18 (AA)");
    expect(recommendGrade(10, 0)).toBe("Screen 18 (AA)");
  });

  it("Screen 15 (AB) for moisture ≤ 14 and defect ≤ 5", () => {
    expect(recommendGrade(14, 5)).toBe("Screen 15 (AB)");
    expect(recommendGrade(14, 3)).toBe("Screen 15 (AB)"); // moisture 14 > 13, fails AA
    expect(recommendGrade(13, 4)).toBe("Screen 15 (AB)"); // defect 4 > 3, fails AA
  });

  it("FAQ for moisture ≤ 15 and defect ≤ 8", () => {
    expect(recommendGrade(15, 8)).toBe("FAQ");
    expect(recommendGrade(15, 6)).toBe("FAQ");
  });

  it("Commercial for moisture ≤ 16 and defect ≤ 12", () => {
    expect(recommendGrade(16, 12)).toBe("Commercial");
    expect(recommendGrade(16, 9)).toBe("Commercial");
  });

  it("Off-grade / Reject for anything beyond Commercial thresholds", () => {
    expect(recommendGrade(17, 13)).toBe("Off-grade / Reject");
    expect(recommendGrade(16, 13)).toBe("Off-grade / Reject"); // defect > 12
    expect(recommendGrade(17, 1)).toBe("Off-grade / Reject"); // moisture > 16
  });
});
