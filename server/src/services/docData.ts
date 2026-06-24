/*
 * Fetches and computes all data needed to render a document PDF.
 * Uses the same shared calc functions as the frontend selectors.
 */

import { pool } from "../db.ts";
import { loadSettings } from "../repos/settings.ts";
import {
  computeQuality,
  computeCosting,
  computeProfitability,
  groupAllocated,
} from "../domain.ts";
import type { Settings } from "../domain.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const q = (sql: string, params?: unknown[]) =>
  pool.query(sql, params).then((r) => r.rows as any[]);

// ── Shared indicative USD/kg by grade (mirrors frontend selectors) ──────────
const INDICATIVE_USD: Record<string, number> = {
  "Bugisu AA": 4.6,
  "Screen 18 (AA)": 4.4,
  "Screen 15 (AB)": 3.9,
  FAQ: 3.2,
  "Robusta Screen 18": 2.85,
  Commercial: 2.6,
  Kiboko: 2.1,
};
function indicativeUsd(grade: string) {
  return INDICATIVE_USD[grade] ?? 3.0;
}

// ── Batch document data ──────────────────────────────────────────────────────

export interface BatchDocData {
  batch: {
    id: string; batch_code: string; status: string;
    origin_district: string; coffee_grade: string;
    gross_weight_kg: number; tare_weight_kg: number;
    net_payable_weight_kg: number | null; clean_output_kg: number | null;
    market_price_per_kg: number; parent_batch_id: string | null;
    created_at: string;
  };
  supplier: { name: string; type: string; contact: string } | null;
  buyer: { name: string; country: string; email: string } | null;
  quality: {
    moisture_pct: number; fallen_matter_pct: number; defect_pct: number;
    defect_breakdown: {
      black_beans_pct: number; broken_pct: number; husks_pct: number;
      insect_damage_pct: number; foreign_matter_pct: number;
    };
    defect_handling_mode: string; recommended_grade: string;
  } | null;
  financials: {
    net_payable_weight_kg: number;
    effective_price_per_kg: number;
    components: Array<{ key: string; label: string; per_kg: number }>;
    landed_cost_per_kg: number;
    total_landed_cost: number;
    selling_price_usd_per_kg: number;
    usd_ugx_rate: number;
    revenue_ugx: number;
    profit_loss_ugx: number;
    margin_pct: number;
  };
  settings: Settings;
}

export async function loadBatchDocData(batchId: string): Promise<BatchDocData | null> {
  const [batches, suppliers, buyers, qualities, expenses, allExpenses, allBatches, forexRows, settings] =
    await Promise.all([
      q(
        `SELECT b.id, b.batch_code, b.status, d.name as origin_district,
                g.name as coffee_grade, b.gross_weight_kg, b.tare_weight_kg,
                b.net_payable_weight_kg, b.clean_output_kg, b.market_price_per_kg,
                b.supplier_id, b.buyer_id, b.parent_batch_id, b.created_at
           FROM batches b
           JOIN districts d ON d.id = b.district_id
           JOIN coffee_grades g ON g.id = b.grade_id
          WHERE b.id = $1`,
        [batchId],
      ),
      q(
        `SELECT s.name, s.type, s.contact FROM suppliers s
           JOIN batches b ON b.supplier_id = s.id WHERE b.id = $1`,
        [batchId],
      ),
      q(
        `SELECT c.name, c.country, c.email FROM clients c
           JOIN batches b ON b.buyer_id = c.id WHERE b.id = $1`,
        [batchId],
      ),
      q(
        `SELECT q.moisture_pct, q.fallen_matter_pct, q.defect_pct,
                q.black_beans_pct, q.broken_pct, q.husks_pct,
                q.insect_damage_pct, q.foreign_matter_pct,
                q.defect_handling_mode, g.name as recommended_grade
           FROM quality_metrics q
           JOIN coffee_grades g ON g.id = q.recommended_grade_id
          WHERE q.batch_id = $1`,
        [batchId],
      ),
      // Expenses for THIS batch (with category name)
      q(
        `SELECT e.amount_ugx, e.basis, e.allocation_group_id, e.note, c.name as category
           FROM expense_lines e
           JOIN expense_categories c ON c.id = e.category_id
          WHERE e.batch_id = $1`,
        [batchId],
      ),
      // All expense lines (for group-kg calc)
      q(`SELECT batch_id, allocation_group_id, basis FROM expense_lines`),
      // All batches (for group-kg calc)
      q(`SELECT id, net_payable_weight_kg FROM batches`),
      // Forex — locked first, then latest global
      q(
        `SELECT usd_ugx_rate, batch_id FROM forex_snapshots
          ORDER BY (batch_id = $1) DESC NULLS LAST, captured_at DESC LIMIT 2`,
        [batchId],
      ),
      loadSettings(),
    ]);

  if (!batches[0]) return null;
  const batch = batches[0];

  // ── Financial calculation (mirrors batchFinancials selector) ──────────────
  const qualityRow = qualities[0] ?? null;
  const defect_pct = qualityRow?.defect_pct ?? 0;

  let net_payable_weight_kg = batch.net_payable_weight_kg ?? batch.gross_weight_kg - batch.tare_weight_kg;
  let effective_price_per_kg = batch.market_price_per_kg;

  if (qualityRow) {
    const qCalc = computeQuality(
      {
        gross_weight_kg: batch.gross_weight_kg,
        tare_weight_kg: batch.tare_weight_kg,
        moisture_pct: qualityRow.moisture_pct,
        fallen_matter_pct: qualityRow.fallen_matter_pct,
        defect_pct,
        defect_handling_mode: qualityRow.defect_handling_mode,
        market_price_per_kg: batch.market_price_per_kg,
      },
      settings,
    );
    net_payable_weight_kg = qCalc.net_payable_weight_kg;
    effective_price_per_kg = qCalc.effective_price_per_kg;
  }

  // Allocation group totals (mirrors allocationGroupKg)
  const netByBatch = new Map(allBatches.map((b: any) => [b.id, b.net_payable_weight_kg ?? 0]));
  const groups: Record<string, Set<string>> = {};
  for (const e of allExpenses) {
    if (e.basis === "allocated" && e.allocation_group_id && e.batch_id) {
      (groups[e.allocation_group_id] ??= new Set()).add(e.batch_id);
    }
  }
  const groupKg: Record<string, number> = {};
  for (const [gid, batchIds] of Object.entries(groups)) {
    groupKg[gid] = [...(batchIds as Set<string>)].reduce(
      (sum, id) => sum + (netByBatch.get(id) ?? 0),
      0,
    );
  }

  const expenseLines = expenses.map((e: any) => ({
    id: e.allocation_group_id ?? e.category,
    batch_id: batchId,
    category: e.category,
    amount_ugx: e.amount_ugx,
    basis: e.basis,
    allocation_group_id: e.allocation_group_id ?? null,
    note: e.note,
    added_by: "",
    created_at: "",
    created_by: "",
  }));

  const allocated = groupAllocated(expenseLines, groupKg);
  const perKgExtra = expenseLines
    .filter((l: any) => l.basis === "per_kg")
    .map((l: any) => ({ category: l.category, amount_ugx: l.amount_ugx, note: l.note }));

  const quantity_kg = batch.clean_output_kg ?? net_payable_weight_kg;
  const costing = computeCosting(effective_price_per_kg, net_payable_weight_kg, allocated, settings, perKgExtra);

  const usdRate = forexRows.find((f: any) => f.batch_id === batchId)?.usd_ugx_rate
    ?? forexRows.find((f: any) => !f.batch_id)?.usd_ugx_rate
    ?? 0;

  const selling_price_usd_per_kg = indicativeUsd(batch.coffee_grade);
  const prof = computeProfitability({
    selling_price_usd_per_kg,
    usd_ugx_rate: usdRate,
    quantity_kg,
    total_landed_cost: costing.total_landed_cost,
    aob_expenses: 0,
    target_margin_pct: settings.target_margin_pct,
  });

  return {
    batch: {
      ...batch,
      net_payable_weight_kg: batch.net_payable_weight_kg,
    },
    supplier: suppliers[0] ?? null,
    buyer: buyers[0] ?? null,
    quality: qualityRow
      ? {
          moisture_pct: qualityRow.moisture_pct,
          fallen_matter_pct: qualityRow.fallen_matter_pct,
          defect_pct,
          defect_breakdown: {
            black_beans_pct: qualityRow.black_beans_pct,
            broken_pct: qualityRow.broken_pct,
            husks_pct: qualityRow.husks_pct,
            insect_damage_pct: qualityRow.insect_damage_pct,
            foreign_matter_pct: qualityRow.foreign_matter_pct,
          },
          defect_handling_mode: qualityRow.defect_handling_mode,
          recommended_grade: qualityRow.recommended_grade,
        }
      : null,
    financials: {
      net_payable_weight_kg,
      effective_price_per_kg,
      components: costing.components.map((c) => ({
        key: c.key,
        label: c.label,
        per_kg: c.per_kg,
      })),
      landed_cost_per_kg: costing.landed_cost_per_kg,
      total_landed_cost: costing.total_landed_cost,
      selling_price_usd_per_kg,
      usd_ugx_rate: usdRate,
      revenue_ugx: prof.revenue_ugx,
      profit_loss_ugx: prof.profit_loss_ugx,
      margin_pct: prof.margin_pct,
    },
    settings,
  };
}

// ── Shipment document data ───────────────────────────────────────────────────

export interface ShipmentDocData {
  shipment: { id: string; container_no: string; seal_no: string; destination_country: string };
  buyer: { name: string; country: string; email: string } | null;
  contributions: Array<{
    batch_code: string; coffee_grade: string; origin_district: string;
    supplier_name: string; qty_kg: number;
  }>;
  total_kg: number;
}

export async function loadShipmentDocData(shipmentId: string): Promise<ShipmentDocData | null> {
  const [shipments, buyers, contribs] = await Promise.all([
    q(`SELECT id, container_no, seal_no, destination_country FROM shipments WHERE id = $1`, [shipmentId]),
    q(
      `SELECT c.name, c.country, c.email FROM clients c
         JOIN shipments s ON s.buyer_id = c.id WHERE s.id = $1`,
      [shipmentId],
    ),
    q(
      `SELECT ca.qty_kg, b.batch_code, d.name as origin_district,
              g.name as coffee_grade, COALESCE(s.name, '—') as supplier_name
         FROM container_allocations ca
         JOIN batches b ON b.id = ca.batch_id
         JOIN coffee_grades g ON g.id = b.grade_id
         JOIN districts d ON d.id = b.district_id
         LEFT JOIN suppliers s ON s.id = b.supplier_id
        WHERE ca.shipment_id = $1
        ORDER BY b.batch_code`,
      [shipmentId],
    ),
  ]);

  if (!shipments[0]) return null;

  return {
    shipment: shipments[0],
    buyer: buyers[0] ?? null,
    contributions: contribs,
    total_kg: contribs.reduce((s: number, c: any) => s + Number(c.qty_kg), 0),
  };
}
