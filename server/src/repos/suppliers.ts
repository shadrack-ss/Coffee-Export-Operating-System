import { withTx } from "../db.ts";

export interface CreateSupplierArgs {
  name: string;
  type: string;
  district_id: number;
  contact: string;
  gps_lat?: number | null;
  gps_lng?: number | null;
  actor: string;
}

export interface UpdateSupplierArgs extends Partial<Omit<CreateSupplierArgs, "actor">> {
  id: string;
  actor: string;
}

function httpError(status: number, code: string): Error {
  return Object.assign(new Error(code), { statusCode: status, code });
}

export async function createSupplier(a: CreateSupplierArgs) {
  return withTx(async (c) => {
    const ins = await c.query(
      `INSERT INTO suppliers (name, type, district_id, contact, gps_lat, gps_lng, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [a.name, a.type, a.district_id, a.contact, a.gps_lat ?? null, a.gps_lng ?? null, a.actor],
    );
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, at)
       VALUES ($1, 'create_supplier', 'supplier', $2, $3)`,
      [a.actor, ins.rows[0].id, new Date().toISOString()],
    );
    return ins.rows[0];
  });
}

export async function updateSupplier(a: UpdateSupplierArgs) {
  return withTx(async (c) => {
    const found = await c.query<{ id: string }>(
      `SELECT id FROM suppliers WHERE id = $1`,
      [a.id],
    );
    if (!found.rows[0]) throw httpError(404, "supplier_not_found");

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (a.name !== undefined)        { setClauses.push(`name = $${idx++}`);        params.push(a.name); }
    if (a.type !== undefined)        { setClauses.push(`type = $${idx++}`);        params.push(a.type); }
    if (a.district_id !== undefined) { setClauses.push(`district_id = $${idx++}`); params.push(a.district_id); }
    if (a.contact !== undefined)     { setClauses.push(`contact = $${idx++}`);     params.push(a.contact); }
    if (a.gps_lat !== undefined)     { setClauses.push(`gps_lat = $${idx++}`);     params.push(a.gps_lat); }
    if (a.gps_lng !== undefined)     { setClauses.push(`gps_lng = $${idx++}`);     params.push(a.gps_lng); }
    if (setClauses.length === 0) throw httpError(400, "no_fields_to_update");

    params.push(a.id);
    const upd = await c.query(
      `UPDATE suppliers SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, at)
       VALUES ($1, 'update_supplier', 'supplier', $2, $3)`,
      [a.actor, a.id, new Date().toISOString()],
    );
    return upd.rows[0];
  });
}
