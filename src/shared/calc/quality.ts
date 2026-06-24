/*
 * 5.1 Procurement & Quality — net payable weight + amount paid to farmer.
 *
 * Deductions are applied IN ORDER. Each step is captured as a DerivationStep so
 * the GRN screen can render a live "show working" panel that exactly mirrors the
 * math. All thresholds come from Settings (no magic numbers here).
 *
 * Acceptance check (spec §8): 1000kg net physical @ 20% MC, MC_standard 14
 *   -> mc_deduction 6% -> 940kg.
 */

import { roundKg, roundPct } from "../lib/money";
import type { Settings, DefectHandlingMode } from "../types";

export interface DerivationStep {
  /** short machine key */
  key: string;
  /** human label, e.g. "After moisture" */
  label: string;
  /** plain-language explanation of the rule applied at this step */
  rule: string;
  /** the resulting weight after this step (kg) */
  weight_kg: number;
  /** the change applied at this step in kg (negative = deduction) */
  delta_kg: number;
}

export interface QualityInput {
  gross_weight_kg: number;
  tare_weight_kg: number;
  moisture_pct: number;
  fallen_matter_pct: number;
  defect_pct: number;
  defect_handling_mode: DefectHandlingMode;
  market_price_per_kg: number;
}

export interface QualityResult {
  net_physical_kg: number;
  mc_deduction_pct: number;
  fm_deduction_kg: number;
  defect_excess_pct: number;
  /** present only when mode === "discount": % cut applied to price */
  price_discount_pct: number;
  effective_price_per_kg: number;
  net_payable_weight_kg: number;
  amount_paid_to_farmer: number;
  steps: DerivationStep[];
}

export function computeQuality(
  input: QualityInput,
  settings: Settings,
): QualityResult {
  const {
    gross_weight_kg,
    tare_weight_kg,
    moisture_pct,
    fallen_matter_pct,
    defect_pct,
    defect_handling_mode,
    market_price_per_kg,
  } = input;

  const steps: DerivationStep[] = [];

  // 0. net physical = gross - tare
  const net_physical_kg = roundKg(gross_weight_kg - tare_weight_kg);
  steps.push({
    key: "net_physical",
    label: "Net physical",
    rule: "Gross weight minus tare (bags & packaging).",
    weight_kg: net_physical_kg,
    delta_kg: roundKg(-tare_weight_kg),
  });

  // 1. moisture: deduct each % above standard from weight
  const mc_deduction_pct = Math.max(0, moisture_pct - settings.mc_standard_pct);
  const weight_after_mc = roundKg(net_physical_kg * (1 - mc_deduction_pct / 100));
  steps.push({
    key: "after_mc",
    label: "After moisture",
    rule: `Standard ${settings.mc_standard_pct}%. Each % above is deducted from weight (${roundPct(
      mc_deduction_pct,
    )}% deducted).`,
    weight_kg: weight_after_mc,
    delta_kg: roundKg(weight_after_mc - net_physical_kg),
  });

  // 2. fallen matter: % of the (configurable) base weight
  const fm_base_weight =
    settings.fm_base === "net_physical" ? net_physical_kg : weight_after_mc;
  const fm_deduction_kg = roundKg(fm_base_weight * (fallen_matter_pct / 100));
  const weight_after_fm = roundKg(weight_after_mc - fm_deduction_kg);
  steps.push({
    key: "after_fm",
    label: "After fallen matter",
    rule: `Fallen matter ${roundPct(fallen_matter_pct)}% of ${
      settings.fm_base === "net_physical"
        ? "net physical weight"
        : "moisture-adjusted weight"
    } deducted.`,
    weight_kg: weight_after_fm,
    delta_kg: roundKg(-fm_deduction_kg),
  });

  // 3. defects: only the EXCESS above standard matters
  const defect_excess_pct = Math.max(
    0,
    defect_pct - settings.defect_standard_pct,
  );
  let weight_after_defects = weight_after_fm;
  let price_discount_pct = 0;

  if (defect_excess_pct > 0 && defect_handling_mode === "weight") {
    weight_after_defects = roundKg(
      weight_after_fm * (1 - defect_excess_pct / 100),
    );
    steps.push({
      key: "after_defects",
      label: "After defects",
      rule: `Standard ${settings.defect_standard_pct}%. Excess ${roundPct(
        defect_excess_pct,
      )}% deducted from weight.`,
      weight_kg: weight_after_defects,
      delta_kg: roundKg(weight_after_defects - weight_after_fm),
    });
  } else if (defect_excess_pct > 0 && defect_handling_mode === "discount") {
    price_discount_pct = defect_excess_pct;
    steps.push({
      key: "after_defects",
      label: "After defects",
      rule: `Standard ${settings.defect_standard_pct}%. Excess ${roundPct(
        defect_excess_pct,
      )}% taken as a price discount — weight unchanged.`,
      weight_kg: weight_after_defects,
      delta_kg: 0,
    });
  } else {
    steps.push({
      key: "after_defects",
      label: "After defects",
      rule: `Defects ${roundPct(defect_pct)}% within standard ${
        settings.defect_standard_pct
      }% — no deduction.`,
      weight_kg: weight_after_defects,
      delta_kg: 0,
    });
  }

  // 4 & 5. net payable + amount paid
  const net_payable_weight_kg = weight_after_defects;
  const effective_price_per_kg = Math.round(
    market_price_per_kg * (1 - price_discount_pct / 100),
  );
  const amount_paid_to_farmer = Math.round(
    effective_price_per_kg * net_payable_weight_kg,
  );

  return {
    net_physical_kg,
    mc_deduction_pct: roundPct(mc_deduction_pct),
    fm_deduction_kg,
    defect_excess_pct: roundPct(defect_excess_pct),
    price_discount_pct: roundPct(price_discount_pct),
    effective_price_per_kg,
    net_payable_weight_kg,
    amount_paid_to_farmer,
    steps,
  };
}

/**
 * Rule-based grade recommendation — a deterministic mapping, not a model.
 * Conservative thresholds for Ugandan FAQ-style screening.
 */
export function recommendGrade(
  moisture_pct: number,
  defect_pct: number,
): string {
  if (moisture_pct <= 13 && defect_pct <= 3) return "Screen 18 (AA)";
  if (moisture_pct <= 14 && defect_pct <= 5) return "Screen 15 (AB)";
  if (moisture_pct <= 15 && defect_pct <= 8) return "FAQ";
  if (moisture_pct <= 16 && defect_pct <= 12) return "Commercial";
  return "Off-grade / Reject";
}
