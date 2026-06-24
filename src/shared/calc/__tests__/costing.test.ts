import { describe, it, expect } from "vitest";
import {
  perKgComponents,
  computeCosting,
  suggestedGunnyPerKg,
  groupAllocated,
} from "../costing";
import type { Settings, ExpenseLine } from "../../types";

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

const baseExpense = {
  id: "e1",
  created_at: "2026-01-01T00:00:00Z",
  created_by: "user-1",
  batch_id: "b1",
  added_by: "user-1",
} as const;

describe("perKgComponents", () => {
  it("includes purchase, URA tax, handling, gunny, paperwork", () => {
    const components = perKgComponents(5000, baseSettings);
    const keys = components.map((c) => c.key);
    expect(keys).toEqual(["purchase", "ura_tax", "handling", "gunny_bags", "paperwork"]);
  });

  it("URA tax is 2% of purchase price, rounded to whole UGX", () => {
    const components = perKgComponents(5000, baseSettings);
    const ura = components.find((c) => c.key === "ura_tax")!;
    expect(ura.per_kg).toBe(100); // Math.round(5000 * 2/100) = 100
  });

  it("rounds URA tax correctly for non-round prices", () => {
    // 3% of 7350 = 220.5 → 221
    const components = perKgComponents(7350, { ...baseSettings, ura_tax_pct: 3 });
    const ura = components.find((c) => c.key === "ura_tax")!;
    expect(ura.per_kg).toBe(221);
  });

  it("gunny bags are flagged as USD-linked", () => {
    const components = perKgComponents(5000, baseSettings);
    const gunny = components.find((c) => c.key === "gunny_bags")!;
    expect(gunny.usd_linked).toBe(true);
  });
});

describe("computeCosting", () => {
  it("spec example: allocated 2 M UGX ÷ 20 000 kg = 100 UGX/kg", () => {
    const result = computeCosting(
      5000,
      20_000,
      [
        {
          category: "Transport",
          amount_ugx: 2_000_000,
          allocation_group_id: "g1",
          total_group_kg: 20_000,
          note: undefined,
        },
      ],
      baseSettings,
    );

    const alloc = result.components.find((c) => c.key === "alloc_g1")!;
    expect(alloc.per_kg).toBe(100);
  });

  it("landed_cost_per_kg = sum of all component per_kg rates", () => {
    const result = computeCosting(5000, 1000, [], baseSettings);
    const sum = result.components.reduce((s, c) => s + c.per_kg, 0);
    expect(result.landed_cost_per_kg).toBe(sum);
  });

  it("total_landed_cost = landed_cost_per_kg × net_kg, rounded to integer", () => {
    const result = computeCosting(5000, 1000, [], baseSettings);
    expect(result.total_landed_cost).toBe(
      Math.round(result.landed_cost_per_kg * 1000),
    );
    expect(Number.isInteger(result.total_landed_cost)).toBe(true);
  });

  it("per-kg extra expenses are appended as per_kg components", () => {
    const result = computeCosting(5000, 1000, [], baseSettings, [
      { category: "Storage", amount_ugx: 50 },
    ]);
    const extra = result.components.find((c) => c.key === "perkg_Storage")!;
    expect(extra.per_kg).toBe(50);
    expect(extra.basis).toBe("per_kg");
  });

  it("allocated expense with zero group kg resolves to 0 per_kg", () => {
    const result = computeCosting(
      5000,
      1000,
      [
        {
          category: "Orphan",
          amount_ugx: 500_000,
          allocation_group_id: "g99",
          total_group_kg: 0,
        },
      ],
      baseSettings,
    );
    const orphan = result.components.find((c) => c.key === "alloc_g99")!;
    expect(orphan.per_kg).toBe(0);
  });
});

describe("suggestedGunnyPerKg", () => {
  it("scales current rate by live/ref ratio", () => {
    // ref=3600, live=3900, current=109 → Math.round(109 * 3900/3600) = 118
    const result = suggestedGunnyPerKg(baseSettings, 3900);
    expect(result).toBe(118);
  });

  it("returns current value when ref rate is 0", () => {
    const result = suggestedGunnyPerKg(
      { ...baseSettings, gunny_bags_usd_ref_rate: 0 },
      3900,
    );
    expect(result).toBe(109);
  });

  it("result is always a whole integer", () => {
    const result = suggestedGunnyPerKg(baseSettings, 3750);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("groupAllocated", () => {
  const groupKg: Record<string, number> = { g1: 5000, g2: 10000 };

  it("filters to only allocated basis lines", () => {
    const lines: ExpenseLine[] = [
      { ...baseExpense, id: "e1", category: "Transport", amount_ugx: 500_000, basis: "allocated", allocation_group_id: "g1" },
      { ...baseExpense, id: "e2", category: "Handling", amount_ugx: 200, basis: "per_kg", allocation_group_id: null },
    ];
    const result = groupAllocated(lines, groupKg);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Transport");
  });

  it("maps total_group_kg from groupKgById", () => {
    const lines: ExpenseLine[] = [
      { ...baseExpense, id: "e1", category: "Transport", amount_ugx: 500_000, basis: "allocated", allocation_group_id: "g1" },
    ];
    const result = groupAllocated(lines, groupKg);
    expect(result[0].total_group_kg).toBe(5000);
  });

  it("uses 0 kg for an unknown group id", () => {
    const lines: ExpenseLine[] = [
      { ...baseExpense, id: "e1", category: "Port", amount_ugx: 100_000, basis: "allocated", allocation_group_id: "unknown" },
    ];
    const result = groupAllocated(lines, groupKg);
    expect(result[0].total_group_kg).toBe(0);
  });
});
