/* Forex writes — global rate snapshots + per-batch rate locks. */

import { pool, withTx } from "../db.ts";

export async function setLiveRate(rate: number, source: string, actor: string) {
  await pool.query(
    `INSERT INTO forex_snapshots (batch_id, usd_ugx_rate, source, captured_at, created_by)
     VALUES (NULL, $1, $2, now(), $3)`,
    [rate, source, actor],
  );
}

/** Latest global (batch_id IS NULL) USD/UGX rate, or null if none yet. */
export async function getLatestRate(): Promise<number | null> {
  const r = await pool.query<{ usd_ugx_rate: string }>(
    `SELECT usd_ugx_rate FROM forex_snapshots
      WHERE batch_id IS NULL
      ORDER BY captured_at DESC
      LIMIT 1`,
  );
  return r.rows[0] ? Number(r.rows[0].usd_ugx_rate) : null;
}

/**
 * Resolve a real user id to attribute automated (non-user) writes to.
 * forex_snapshots.created_by is NOT NULL, so background jobs can't use a
 * literal like "system" — pick the earliest active admin instead.
 */
export async function resolveSystemActor(): Promise<string | null> {
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM users
      WHERE active = true AND role = 'admin'
      ORDER BY created_at ASC
      LIMIT 1`,
  );
  return r.rows[0]?.id ?? null;
}

export async function lockRate(
  batchId: string,
  rate: number,
  source: string,
  actor: string,
) {
  return withTx(async (c) => {
    await c.query(
      `INSERT INTO forex_snapshots (batch_id, usd_ugx_rate, source, captured_at, created_by)
       VALUES ($1, $2, $3, now(), $4)`,
      [batchId, rate, source, actor],
    );
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, new_value, at)
       VALUES ($1, 'lock_rate', 'batch', $2, 'usd_ugx_rate', $3, now())`,
      [actor, batchId, String(rate)],
    );
  });
}
