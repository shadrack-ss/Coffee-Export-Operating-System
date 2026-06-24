/* Approval workflow — approve a batch's outgoing cash (§5.6). */

import { withTx } from "../db.ts";

function httpError(status: number, code: string): Error {
  return Object.assign(new Error(code), { statusCode: status, code });
}

const FINAL = ["approved", "allocated", "exported"];

export async function approveBatch(batchId: string, actor: string) {
  return withTx(async (c) => {
    const found = await c.query(`SELECT * FROM batches WHERE id = $1`, [batchId]);
    const batch = found.rows[0];
    if (!batch) throw httpError(404, "batch_not_found");
    if (FINAL.includes(batch.status)) throw httpError(400, "already_approved");
    if (batch.net_payable_weight_kg == null) throw httpError(400, "not_graded");

    // Outgoing cash = amount payable to the farmer (net payable × agreed price).
    const amount = Math.round(
      Number(batch.net_payable_weight_kg) * Number(batch.market_price_per_kg),
    );
    const ts = new Date().toISOString();

    await c.query(
      `INSERT INTO approvals (batch_id, approved_by, approved_at, amount_ugx, created_by)
       VALUES ($1, $2, $3, $4, $2)`,
      [batchId, actor, ts, amount],
    );
    await c.query(`UPDATE batches SET status = 'approved' WHERE id = $1`, [batchId]);
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, old_value, new_value, at)
       VALUES ($1, 'approve_payment', 'batch', $2, 'status', $3, 'approved', $4)`,
      [actor, batchId, batch.status, ts],
    );

    return { batch_id: batchId, amount_ugx: amount };
  });
}
