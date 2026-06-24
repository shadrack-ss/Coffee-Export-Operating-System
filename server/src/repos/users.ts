import { withTx } from "../db.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";

function httpError(status: number, code: string): Error {
  return Object.assign(new Error(code), { statusCode: status, code });
}

export interface CreateUserArgs {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  temp_password: string;
  actor: string;
}

export interface UpdateUserArgs {
  id: string;
  name?: string;
  role?: string;
  actor: string;
}

export async function createUser(a: CreateUserArgs) {
  return withTx(async (c) => {
    const exists = await c.query<{ id: string; conflict: string }>(
      `SELECT id,
              CASE WHEN lower(email) = lower($1) THEN 'email' ELSE 'phone' END AS conflict
         FROM users
        WHERE lower(email) = lower($1) OR ($2::text IS NOT NULL AND phone = $2)`,
      [a.email, a.phone ?? null],
    );
    if (exists.rows[0]) {
      throw httpError(409, exists.rows[0].conflict === "email" ? "email_taken" : "phone_taken");
    }

    const hash = hashPassword(a.temp_password);
    const ins = await c.query(
      `INSERT INTO users (name, email, phone, role, password_hash, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, role, active, created_at`,
      [a.name, a.email, a.phone ?? null, a.role, hash, a.actor],
    );
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, new_value, at)
       VALUES ($1, 'create_user', 'user', $2, 'role', $3, $4)`,
      [a.actor, ins.rows[0].id, a.role, new Date().toISOString()],
    );
    return ins.rows[0] as { id: string; name: string; email: string; phone: string | null; role: string; active: boolean };
  });
}

export async function updateUser(a: UpdateUserArgs) {
  return withTx(async (c) => {
    const found = await c.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1`,
      [a.id],
    );
    if (!found.rows[0]) throw httpError(404, "user_not_found");

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (a.name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(a.name); }
    if (a.role !== undefined) { setClauses.push(`role = $${idx++}`); params.push(a.role); }
    if (setClauses.length === 0) throw httpError(400, "no_fields_to_update");

    params.push(a.id);
    const upd = await c.query(
      `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${idx}
       RETURNING id, name, email, role, active`,
      params,
    );
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, at)
       VALUES ($1, 'update_user', 'user', $2, $3)`,
      [a.actor, a.id, new Date().toISOString()],
    );
    return upd.rows[0];
  });
}

/** A logged-in user changes their own password (must supply the current one). */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  return withTx(async (c) => {
    const found = await c.query<{ password_hash: string | null }>(
      `SELECT password_hash FROM users WHERE id = $1 AND active = true`,
      [userId],
    );
    const row = found.rows[0];
    if (!row || !row.password_hash) throw httpError(404, "user_not_found");
    if (!verifyPassword(currentPassword, row.password_hash)) {
      throw httpError(401, "current_password_incorrect");
    }
    await c.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      hashPassword(newPassword),
      userId,
    ]);
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, at)
       VALUES ($1, 'change_password', 'user', $1, 'password_hash', $2)`,
      [userId, new Date().toISOString()],
    );
    return { ok: true };
  });
}

/** An admin sets a new temporary password for another user. */
export async function resetUserPassword(
  id: string,
  newPassword: string,
  actor: string,
) {
  return withTx(async (c) => {
    const found = await c.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1`,
      [id],
    );
    if (!found.rows[0]) throw httpError(404, "user_not_found");
    await c.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      hashPassword(newPassword),
      id,
    ]);
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, at)
       VALUES ($1, 'reset_password', 'user', $2, 'password_hash', $3)`,
      [actor, id, new Date().toISOString()],
    );
    return { ok: true };
  });
}

export async function deactivateUser(id: string, actor: string) {
  return withTx(async (c) => {
    if (id === actor) throw httpError(400, "cannot_deactivate_self");
    const found = await c.query<{ id: string; active: boolean }>(
      `SELECT id, active FROM users WHERE id = $1`,
      [id],
    );
    if (!found.rows[0]) throw httpError(404, "user_not_found");
    if (!found.rows[0].active) throw httpError(400, "already_inactive");

    await c.query(`UPDATE users SET active = false WHERE id = $1`, [id]);
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, old_value, new_value, at)
       VALUES ($1, 'deactivate_user', 'user', $2, 'active', 'true', 'false', $3)`,
      [actor, id, new Date().toISOString()],
    );
    return { ok: true };
  });
}
