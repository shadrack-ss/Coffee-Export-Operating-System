/*
 * 5.3 Processing & Yield — coffee changing form, and re-costing the output.
 *
 *  yield_%               = output_kg ÷ input_kg × 100
 *  loss_kg               = input_kg − output_kg
 *  true_cost_per_kg_clean = total_accumulated_batch_cost ÷ clean_output_kg
 *
 * The sellable child batch carries the FULL cost of the intake it came from —
 * cost/kg is a chain (intake → landed → after processing), so callers must
 * always label which basis a displayed cost/kg uses.
 *
 * Acceptance check (spec §8): 1000kg -> 850kg = 85% yield.
 */

import { roundKg, roundPct, ratePerKg } from "../lib/money";

export interface ProcessingResult {
  input_kg: number;
  output_kg: number;
  yield_pct: number;
  loss_kg: number;
  true_cost_per_kg_clean: number;
}

export function computeProcessing(
  input_kg: number,
  output_kg: number,
  total_accumulated_batch_cost: number,
): ProcessingResult {
  const yield_pct = input_kg > 0 ? roundPct((output_kg / input_kg) * 100) : 0;
  const loss_kg = roundKg(input_kg - output_kg);
  const true_cost_per_kg_clean = ratePerKg(
    total_accumulated_batch_cost,
    output_kg,
  );

  return {
    input_kg: roundKg(input_kg),
    output_kg: roundKg(output_kg),
    yield_pct,
    loss_kg,
    true_cost_per_kg_clean,
  };
}
