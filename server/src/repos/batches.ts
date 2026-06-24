/* Data access for batches — plain parameterised SQL over the pool. */

import type { PoolClient } from "pg";
import { pool } from "../db.ts";

export interface BatchRow {
  id: string;
  batch_code: string;
  supplier_id: string;
  district_id: number;
  grade_id: number;
  parent_batch_id: string | null;
  status: string;
  gross_weight_kg: number;
  tare_weight_kg: number;
  net_payable_weight_kg: number | null;
  clean_output_kg: number | null;
  buyer_id: string | null;
  market_price_per_kg: number;
  created_at: string;
}

export async function listBatches(): Promise<BatchRow[]> {
  const { rows } = await pool.query<BatchRow>(
    `SELECT * FROM batches ORDER BY created_at DESC`,
  );
  return rows;
}

export async function getBatch(id: string): Promise<BatchRow | null> {
  const { rows } = await pool.query<BatchRow>(
    `SELECT * FROM batches WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Next human batch code for a district, e.g. MBL-2026-0004. */
export async function nextBatchCode(
  client: PoolClient,
  districtId: number,
): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await client.query<{ code: string }>(
    `SELECT code FROM districts WHERE id = $1`,
    [districtId],
  );
  const code = rows[0]?.code ?? "GEN";
  const prefix = `${code}-${year}-`;
  const { rows: cnt } = await client.query<{ n: string }>(
    `SELECT count(*)::int AS n FROM batches WHERE batch_code LIKE $1`,
    [`${prefix}%`],
  );
  const seq = Number(cnt[0]?.n ?? 0) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}
