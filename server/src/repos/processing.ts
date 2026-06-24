/* Processing write — creates the child batch + record, advances the parent. */

import { withTx } from "../db.ts";
import { computeProcessing } from "../domain.ts";
import type { ProcessType } from "../domain.ts";

function httpError(status: number, code: string): Error {
  return Object.assign(new Error(code), { statusCode: status, code });
}

export interface RecordProcessingArgs {
  input_batch_id: string;
  input_kg: number;
  output_kg: number;
  process_type: ProcessType;
  actor: string;
}

export async function recordProcessing(a: RecordProcessingArgs) {
  return withTx(async (c) => {
    const found = await c.query(`SELECT * FROM batches WHERE id = $1`, [
      a.input_batch_id,
    ]);
    const parent = found.rows[0];
    if (!parent) throw httpError(404, "batch_not_found");

    const proc = computeProcessing(a.input_kg, a.output_kg, 0);
    const cnt = await c.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM batches WHERE parent_batch_id = $1`,
      [parent.id],
    );
    const n = cnt.rows[0].n;
    const childCode =
      n === 0 ? `${parent.batch_code}-C` : `${parent.batch_code}-C${n + 1}`;
    const ts = new Date().toISOString();

    const child = await c.query<{ id: string }>(
      `INSERT INTO batches
         (batch_code, supplier_id, district_id, grade_id, parent_batch_id, status,
          gross_weight_kg, tare_weight_kg, net_payable_weight_kg, clean_output_kg,
          buyer_id, market_price_per_kg, created_by)
       VALUES ($1,$2,$3,$4,$5,'processed',$6,0,$6,$6,$7,$8,$9) RETURNING id`,
      [
        childCode,
        parent.supplier_id,
        parent.district_id,
        parent.grade_id,
        parent.id,
        a.output_kg,
        parent.buyer_id,
        parent.market_price_per_kg,
        a.actor,
      ],
    );
    const childId = child.rows[0].id;

    await c.query(
      `INSERT INTO processing_records
         (input_batch_id, output_batch_id, input_kg, output_kg, yield_pct, loss_kg, process_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [parent.id, childId, proc.input_kg, proc.output_kg, proc.yield_pct, proc.loss_kg, a.process_type, a.actor],
    );
    await c.query(`UPDATE batches SET status = 'processed' WHERE id = $1`, [parent.id]);
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, old_value, new_value, at)
       VALUES ($1, 'record_processing', 'batch', $2, 'status', $3, 'processed', $4)`,
      [a.actor, parent.id, parent.status, ts],
    );

    return { child_batch_id: childId, batch_code: childCode };
  });
}
