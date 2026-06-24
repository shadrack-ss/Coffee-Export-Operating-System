import { withTx } from "../db.ts";

function httpError(status: number, code: string): Error {
  return Object.assign(new Error(code), { statusCode: status, code });
}

export interface CreateShipmentArgs {
  container_no: string;
  seal_no: string;
  buyer_id: string;
  destination_country: string;
  actor: string;
}

export interface AllocateBatchArgs {
  shipment_id: string;
  batch_id: string;
  qty_kg: number;
  actor: string;
}

export async function createShipment(a: CreateShipmentArgs) {
  return withTx(async (c) => {
    const buyer = await c.query<{ id: string }>(
      `SELECT id FROM clients WHERE id = $1`,
      [a.buyer_id],
    );
    if (!buyer.rows[0]) throw httpError(400, "buyer_not_found");

    const ins = await c.query(
      `INSERT INTO shipments (container_no, seal_no, buyer_id, destination_country, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [a.container_no, a.seal_no, a.buyer_id, a.destination_country, a.actor],
    );
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, new_value, at)
       VALUES ($1, 'create_shipment', 'shipment', $2, 'container_no', $3, $4)`,
      [a.actor, ins.rows[0].id, a.container_no, new Date().toISOString()],
    );
    return ins.rows[0];
  });
}

export async function allocateBatch(a: AllocateBatchArgs) {
  return withTx(async (c) => {
    const shipment = await c.query<{ id: string; buyer_id: string }>(
      `SELECT id, buyer_id FROM shipments WHERE id = $1`,
      [a.shipment_id],
    );
    if (!shipment.rows[0]) throw httpError(404, "shipment_not_found");

    const batch = await c.query<{ id: string; status: string }>(
      `SELECT id, status FROM batches WHERE id = $1`,
      [a.batch_id],
    );
    if (!batch.rows[0]) throw httpError(404, "batch_not_found");
    if (!["approved", "allocated"].includes(batch.rows[0].status)) {
      throw httpError(400, "batch_not_approved");
    }

    const dup = await c.query<{ id: string }>(
      `SELECT id FROM container_allocations WHERE shipment_id = $1 AND batch_id = $2`,
      [a.shipment_id, a.batch_id],
    );
    if (dup.rows[0]) throw httpError(400, "already_allocated");

    const ins = await c.query(
      `INSERT INTO container_allocations (shipment_id, batch_id, qty_kg, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [a.shipment_id, a.batch_id, a.qty_kg, a.actor],
    );

    // Advance batch status to allocated and stamp the buyer
    await c.query(
      `UPDATE batches SET status = 'allocated', buyer_id = $1 WHERE id = $2`,
      [shipment.rows[0].buyer_id, a.batch_id],
    );

    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, new_value, at)
       VALUES ($1, 'allocate_batch', 'shipment', $2, 'batch_id', $3, $4)`,
      [a.actor, a.shipment_id, a.batch_id, new Date().toISOString()],
    );
    return ins.rows[0];
  });
}
