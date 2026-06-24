/*
 * 5.2 Costing & Landed Cost — the true landed cost per kilo.
 *
 *  landed_cost_per_kg = purchase_price_per_kg
 *                     + Σ(per-kg components: URA tax, handling, gunny, paperwork)
 *                     + Σ(allocated expenses resolved to per-kg)
 *  total_landed_cost  = landed_cost_per_kg × net_payable_weight_kg
 *
 * Per-kg components and allocated expenses are returned as a build-up table so
 * the accountant sees each UGX/kg line and a running total.
 *
 * Acceptance check (spec §8): allocated 2,000,000 UGX ÷ 20,000 kg = 100 UGX/kg.
 */

import { ratePerKg } from "../lib/money";
import type { ExpenseLine, Settings } from "../types";

export interface CostComponent {
  key: string;
  label: string;
  basis: "purchase" | "per_kg" | "allocated";
  per_kg: number;
  note?: string;
  /** flags a USD-linked line (gunny bags) for recompute prompts */
  usd_linked?: boolean;
  /** for allocated lines: the group they were split across */
  allocation_group_id?: string | null;
}

export interface CostingResult {
  components: CostComponent[];
  landed_cost_per_kg: number;
  total_landed_cost: number;
  net_payable_weight_kg: number;
}

export interface AllocatedExpenseInput {
  category: string;
  amount_ugx: number;
  allocation_group_id: string | null;
  /** total kg the lump sum is spread across (the group's combined weight) */
  total_group_kg: number;
  note?: string;
}

/** A custom per-kg expense line added on top of the Settings defaults. */
export interface PerKgExpenseInput {
  category: string;
  /** amount is already a UGX/kg rate */
  amount_ugx: number;
  note?: string;
}

/**
 * Default per-kg components derived from Settings. `purchase_price_per_kg`
 * is the effective price actually paid (after any quality discount).
 */
export function perKgComponents(
  purchase_price_per_kg: number,
  settings: Settings,
): CostComponent[] {
  return [
    {
      key: "purchase",
      label: "Purchase price",
      basis: "purchase",
      per_kg: purchase_price_per_kg,
    },
    {
      key: "ura_tax",
      label: `URA tax (${settings.ura_tax_pct}% of purchase)`,
      basis: "per_kg",
      per_kg: Math.round(purchase_price_per_kg * (settings.ura_tax_pct / 100)),
    },
    {
      key: "handling",
      label: "Handling",
      basis: "per_kg",
      per_kg: settings.handling_per_kg,
    },
    {
      key: "gunny_bags",
      label: "Gunny bags",
      basis: "per_kg",
      per_kg: settings.gunny_bags_per_kg,
      usd_linked: true,
      note: "USD-linked",
    },
    {
      key: "paperwork",
      label: "Paperwork",
      basis: "per_kg",
      per_kg: settings.paperwork_per_kg,
    },
  ];
}

export function computeCosting(
  purchase_price_per_kg: number,
  net_payable_weight_kg: number,
  allocated: AllocatedExpenseInput[],
  settings: Settings,
  perKgExtra: PerKgExpenseInput[] = [],
): CostingResult {
  const components = perKgComponents(purchase_price_per_kg, settings);

  for (const p of perKgExtra) {
    components.push({
      key: `perkg_${p.category}`,
      label: p.category,
      basis: "per_kg",
      per_kg: p.amount_ugx,
      note: p.note,
    });
  }

  for (const a of allocated) {
    components.push({
      key: `alloc_${a.allocation_group_id ?? a.category}`,
      label: a.category,
      basis: "allocated",
      per_kg: ratePerKg(a.amount_ugx, a.total_group_kg),
      note: a.note,
      allocation_group_id: a.allocation_group_id,
    });
  }

  const landed_cost_per_kg = components.reduce((sum, c) => sum + c.per_kg, 0);
  const total_landed_cost = Math.round(
    landed_cost_per_kg * net_payable_weight_kg,
  );

  return {
    components,
    landed_cost_per_kg,
    total_landed_cost,
    net_payable_weight_kg,
  };
}

/**
 * Suggested gunny-bag per-kg recompute when USD/UGX moves.
 * Scales the reference rate by the live/reference ratio.
 */
export function suggestedGunnyPerKg(
  settings: Settings,
  live_rate: number,
): number {
  if (settings.gunny_bags_usd_ref_rate <= 0) return settings.gunny_bags_per_kg;
  return Math.round(
    settings.gunny_bags_per_kg *
      (live_rate / settings.gunny_bags_usd_ref_rate),
  );
}

/** Resolve allocated expense lines from the store into per-kg inputs. */
export function groupAllocated(
  lines: ExpenseLine[],
  groupKgById: Record<string, number>,
): AllocatedExpenseInput[] {
  return lines
    .filter((l) => l.basis === "allocated")
    .map((l) => ({
      category: l.category,
      amount_ugx: l.amount_ugx,
      allocation_group_id: l.allocation_group_id,
      total_group_kg: l.allocation_group_id
        ? (groupKgById[l.allocation_group_id] ?? 0)
        : 0,
      note: l.note,
    }));
}
