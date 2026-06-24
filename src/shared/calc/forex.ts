/*
 * 5.4 Financial Intelligence — forex & profitability.
 *
 *  revenue_ugx          = selling_price_usd_per_kg × usd_ugx_rate × quantity_kg
 *  profit_loss_ugx      = revenue_ugx − total_landed_cost − aob_expenses
 *  breakeven_usd_per_kg = (total_landed_cost + aob) ÷ (usd_ugx_rate × quantity_kg)
 *
 * Risk flag: if the live rate is below the rate required to hit the target
 * margin, the batch is "High Risk for Loss".
 */

import { roundPct } from "../lib/money";

export type RiskLevel = "safe" | "watch" | "risk";

export interface ProfitabilityInput {
  selling_price_usd_per_kg: number;
  usd_ugx_rate: number;
  quantity_kg: number;
  total_landed_cost: number;
  aob_expenses: number;
  target_margin_pct: number;
}

export interface ProfitabilityResult {
  revenue_ugx: number;
  profit_loss_ugx: number;
  margin_pct: number;
  breakeven_usd_per_kg: number;
  /** USD/UGX rate needed (at current selling price) to hit target margin */
  rate_for_target_margin: number;
  risk: RiskLevel;
}

export function computeProfitability(
  input: ProfitabilityInput,
): ProfitabilityResult {
  const {
    selling_price_usd_per_kg,
    usd_ugx_rate,
    quantity_kg,
    total_landed_cost,
    aob_expenses,
    target_margin_pct,
  } = input;

  const revenue_ugx = Math.round(
    selling_price_usd_per_kg * usd_ugx_rate * quantity_kg,
  );
  const total_cost = total_landed_cost + aob_expenses;
  const profit_loss_ugx = revenue_ugx - total_cost;
  const margin_pct =
    revenue_ugx > 0 ? roundPct((profit_loss_ugx / revenue_ugx) * 100) : 0;

  const usd_revenue = selling_price_usd_per_kg * quantity_kg;
  const breakeven_usd_per_kg =
    usd_ugx_rate > 0 && quantity_kg > 0
      ? Math.round((total_cost / (usd_ugx_rate * quantity_kg)) * 10000) / 10000
      : 0;

  // rate needed so that revenue gives (target_margin) margin:
  //   revenue = total_cost / (1 - margin)   ->   rate = revenue / usd_revenue
  const target_revenue = total_cost / (1 - target_margin_pct / 100);
  const rate_for_target_margin =
    usd_revenue > 0 ? Math.round(target_revenue / usd_revenue) : 0;

  let risk: RiskLevel;
  if (profit_loss_ugx < 0) {
    risk = "risk";
  } else if (usd_ugx_rate < rate_for_target_margin) {
    risk = "watch";
  } else {
    risk = "safe";
  }

  return {
    revenue_ugx,
    profit_loss_ugx,
    margin_pct,
    breakeven_usd_per_kg,
    rate_for_target_margin,
    risk,
  };
}
