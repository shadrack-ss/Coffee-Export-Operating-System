import { withTx } from "../db.ts";

function httpError(status: number, code: string): Error {
  return Object.assign(new Error(code), { statusCode: status, code });
}

export interface CreateClientArgs {
  name: string;
  country: string;
  email: string;
  segment: string;
  actor: string;
}

export interface UpdateClientArgs {
  id: string;
  name?: string;
  country?: string;
  email?: string;
  segment?: string;
  actor: string;
}

export async function createClient(a: CreateClientArgs) {
  return withTx(async (c) => {
    const ins = await c.query(
      `INSERT INTO clients (name, country, email, segment, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [a.name, a.country, a.email, a.segment, a.actor],
    );
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, at)
       VALUES ($1, 'create_client', 'client', $2, $3)`,
      [a.actor, ins.rows[0].id, new Date().toISOString()],
    );
    return ins.rows[0];
  });
}

export async function updateClient(a: UpdateClientArgs) {
  return withTx(async (c) => {
    const found = await c.query<{ id: string }>(
      `SELECT id FROM clients WHERE id = $1`,
      [a.id],
    );
    if (!found.rows[0]) throw httpError(404, "client_not_found");

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (a.name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(a.name); }
    if (a.country !== undefined) { setClauses.push(`country = $${idx++}`); params.push(a.country); }
    if (a.email !== undefined) { setClauses.push(`email = $${idx++}`); params.push(a.email); }
    if (a.segment !== undefined) { setClauses.push(`segment = $${idx++}`); params.push(a.segment); }
    if (setClauses.length === 0) throw httpError(400, "no_fields_to_update");

    params.push(a.id);
    const upd = await c.query(
      `UPDATE clients SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, at)
       VALUES ($1, 'update_client', 'client', $2, $3)`,
      [a.actor, a.id, new Date().toISOString()],
    );
    return upd.rows[0];
  });
}
