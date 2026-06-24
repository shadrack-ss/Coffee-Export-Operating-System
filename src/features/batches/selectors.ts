/*
 * Derived per-batch financials. Pure functions over store collections — they
 * compose the lib/calc engine so the dashboard, batch rows and detail screens
 * all read the same numbers. (These move into Postgres RPC with the backend.)
 */

import {
  computeQuality,
  computeCosting,
  computeProfitability,
  groupAllocated,
  type CostComponent,
  type PerKgExpenseInput,
  type RiskLevel,
} from "@/shared/calc";
import { ratePerKg } from "@/shared/lib/money";
import type { Batch, ExpenseLine, QualityMetrics } from "@/shared/types";
import type { DataState } from "@/core/store";

/** Indicative FOB selling price (USD/kg) by grade — used for P/L & risk. */
const INDICATIVE_USD_PER_KG: Record<string, number> = {
  "Bugisu AA": 4.6,
  "Screen 18 (AA)": 4.4,
  "Screen 15 (AB)": 3.9,
  FAQ: 3.2,
  "Robusta Screen 18": 2.85,
  Commercial: 2.6,
  Kiboko: 2.1,
};

export function indicativeUsdPerKg(grade: string): number {
  return INDICATIVE_USD_PER_KG[grade] ?? 3.0;
}

export interface BatchFinancials {
  batch: Batch;
  quality?: QualityMetrics;
  net_payable_weight_kg: number;
  effective_price_per_kg: number;
  /** the weight this batch's cost & revenue resolve against (clean output for children) */
  quantity_kg: number;
  /** cost build-up components for display */
  components: CostComponent[];
  landed_cost_per_kg: number;
  total_landed_cost: number;
  /** true for processing outputs (parent_batch_id set) */
  is_child: boolean;
  selling_price_usd_per_kg: number;
  revenue_ugx: number;
  profit_loss_ugx: number;
  margin_pct: number;
  breakeven_usd_per_kg: number;
  risk: RiskLevel;
  locked_rate?: number;
}

/** Expense lines on a batch, split into the two cost bases. */
function batchExpenses(
  batch: Batch,
  state: DataState,
): { allocated: ReturnType<typeof groupAllocated>; perKgExtra: PerKgExpenseInput[] } {
  const groupKg = allocationGroupKg(state.expenses, state.batches);
  const lines = state.expenses.filter((e) => e.batch_id === batch.id);
  const allocated = groupAllocated(lines, groupKg);
  const perKgExtra = lines
    .filter((l) => l.basis === "per_kg")
    .map((l) => ({
      category: l.category,
      amount_ugx: l.amount_ugx,
      note: l.note,
    }));
  return { allocated, perKgExtra };
}

/** Total kg per allocation group (for splitting allocated expenses). */
export function allocationGroupKg(
  expenses: ExpenseLine[],
  batches: Batch[],
): Record<string, number> {
  const netByBatch = new Map(
    batches.map((b) => [b.id, b.net_payable_weight_kg ?? 0]),
  );
  const groups: Record<string, Set<string>> = {};
  for (const e of expenses) {
    if (e.basis === "allocated" && e.allocation_group_id && e.batch_id) {
      (groups[e.allocation_group_id] ??= new Set()).add(e.batch_id);
    }
  }
  const out: Record<string, number> = {};
  for (const [gid, batchIds] of Object.entries(groups)) {
    out[gid] = [...batchIds].reduce(
      (sum, id) => sum + (netByBatch.get(id) ?? 0),
      0,
    );
  }
  return out;
}

export function batchFinancials(
  batch: Batch,
  state: DataState,
  liveRate: number,
  depth = 0,
): BatchFinancials {
  const settings = state.settings;
  const quality = state.quality.find((q) => q.batch_id === batch.id);
  const is_child = !!batch.parent_batch_id;

  // net payable: use computed value if quality exists, else persisted/fallback
  let net_payable_weight_kg = batch.net_payable_weight_kg ?? 0;
  let effective_price = batch.market_price_per_kg;

  if (quality) {
    const q = computeQuality(
      {
        gross_weight_kg: batch.gross_weight_kg,
        tare_weight_kg: batch.tare_weight_kg,
        moisture_pct: quality.moisture_pct,
        fallen_matter_pct: quality.fallen_matter_pct,
        defect_pct: quality.defect_pct,
        defect_handling_mode: quality.defect_handling_mode,
        market_price_per_kg: batch.market_price_per_kg,
      },
      settings,
    );
    net_payable_weight_kg = q.net_payable_weight_kg;
    effective_price = q.effective_price_per_kg;
  }

  const { allocated, perKgExtra } = batchExpenses(batch, state);

  let components: CostComponent[];
  let landed_cost_per_kg: number;
  let total_landed_cost: number;
  let quantity_kg: number;

  if (is_child && depth < 8) {
    // Processing output: cost is a CHAIN — inherit the parent's full landed
    // cost spread over the clean output, then add any post-processing expenses.
    quantity_kg = batch.clean_output_kg ?? net_payable_weight_kg;
    const parent = state.batches.find((b) => b.id === batch.parent_batch_id);
    components = [];
    if (parent) {
      const pf = batchFinancials(parent, state, liveRate, depth + 1);
      components.push({
        key: "inherited",
        label: `Inherited from ${parent.batch_code}`,
        basis: "allocated",
        per_kg: ratePerKg(pf.total_landed_cost, quantity_kg),
        note: "parent landed cost ÷ clean output",
      });
    }
    for (const p of perKgExtra) {
      components.push({
        key: `perkg_${p.category}`,
        label: p.category,
        basis: "per_kg",
        per_kg: p.amount_ugx,
        note: p.note,
      });
    }
    const groupKgAll = allocationGroupKg(state.expenses, state.batches);
    for (const a of allocated) {
      components.push({
        key: `alloc_${a.allocation_group_id ?? a.category}`,
        label: a.category,
        basis: "allocated",
        per_kg: ratePerKg(a.amount_ugx, a.total_group_kg || groupKgAll[a.allocation_group_id ?? ""] || quantity_kg),
        note: a.note,
        allocation_group_id: a.allocation_group_id,
      });
    }
    landed_cost_per_kg = components.reduce((s, c) => s + c.per_kg, 0);
    total_landed_cost = Math.round(landed_cost_per_kg * quantity_kg);
  } else {
    quantity_kg = batch.clean_output_kg ?? net_payable_weight_kg;
    const costing = computeCosting(
      effective_price,
      net_payable_weight_kg,
      allocated,
      settings,
      perKgExtra,
    );
    components = costing.components;
    landed_cost_per_kg = costing.landed_cost_per_kg;
    total_landed_cost = costing.total_landed_cost;
  }

  const selling_price_usd_per_kg = indicativeUsdPerKg(batch.coffee_grade);
  const prof = computeProfitability({
    selling_price_usd_per_kg,
    usd_ugx_rate: liveRate,
    quantity_kg,
    total_landed_cost,
    aob_expenses: 0,
    target_margin_pct: settings.target_margin_pct,
  });

  const locked = state.forex
    .filter((f) => f.batch_id === batch.id)
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];

  return {
    batch,
    quality,
    net_payable_weight_kg,
    effective_price_per_kg: effective_price,
    quantity_kg,
    components,
    landed_cost_per_kg,
    total_landed_cost,
    is_child,
    selling_price_usd_per_kg,
    revenue_ugx: prof.revenue_ugx,
    profit_loss_ugx: prof.profit_loss_ugx,
    margin_pct: prof.margin_pct,
    breakeven_usd_per_kg: prof.breakeven_usd_per_kg,
    risk: prof.risk,
    locked_rate: locked?.usd_ugx_rate,
  };
}

export function allBatchFinancials(
  state: DataState,
  liveRate: number,
): BatchFinancials[] {
  return state.batches.map((b) => batchFinancials(b, state, liveRate));
}
