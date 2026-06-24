/* Expense-line writes — category-name resolution + allocation-group find/create. */

import type { PoolClient } from "pg";
import { withTx } from "../db.ts";
import type { ExpenseBasis } from "../domain.ts";

function httpError(status: number, code: string): Error {
  return Object.assign(new Error(code), { statusCode: status, code });
}

export interface AddExpenseArgs {
  batch_id: string;
  category: string;
  amount_ugx: number;
  basis: ExpenseBasis;
  allocation_group_label: string | null;
  note?: string;
  actor: string;
}

async function resolveGroup(
  c: PoolClient,
  label: string | null,
  actor: string,
): Promise<string> {
  if (label) {
    const found = await c.query<{ id: string }>(
      `SELECT id FROM allocation_groups WHERE label = $1 LIMIT 1`,
      [label],
    );
    if (found.rows[0]) return found.rows[0].id;
  }
  const ins = await c.query<{ id: string }>(
    `INSERT INTO allocation_groups (label, created_by) VALUES ($1, $2) RETURNING id`,
    [label, actor],
  );
  return ins.rows[0].id;
}

export async function addExpense(a: AddExpenseArgs) {
  return withTx(async (c) => {
    const cat = await c.query<{ id: number }>(
      `SELECT id FROM expense_categories WHERE name = $1`,
      [a.category],
    );
    const categoryId = cat.rows[0]?.id;
    if (!categoryId) throw httpError(400, "unknown_category");

    // schema requires allocated lines to have a group, per_kg lines to have none
    const groupId =
      a.basis === "allocated" ? await resolveGroup(c, a.allocation_group_label, a.actor) : null;

    const ts = new Date().toISOString();
    const ins = await c.query(
      `INSERT INTO expense_lines
         (batch_id, category_id, amount_ugx, basis, allocation_group_id, note, added_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
      [a.batch_id, categoryId, a.amount_ugx, a.basis, groupId, a.note ?? null, a.actor],
    );
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, new_value, at)
       VALUES ($1, 'add_expense', 'batch', $2, 'amount_ugx', $3, $4)`,
      [a.actor, a.batch_id, String(a.amount_ugx), ts],
    );
    return ins.rows[0];
  });
}

export async function deleteExpense(id: string, actor: string): Promise<boolean> {
  return withTx(async (c) => {
    const found = await c.query<{ batch_id: string; amount_ugx: number }>(
      `SELECT batch_id, amount_ugx FROM expense_lines WHERE id = $1`,
      [id],
    );
    const row = found.rows[0];
    if (!row) return false;
    await c.query(`DELETE FROM expense_lines WHERE id = $1`, [id]);
    await c.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, field, old_value, at)
       VALUES ($1, 'remove_expense', 'batch', $2, 'amount_ugx', $3, $4)`,
      [actor, row.batch_id, String(row.amount_ugx), new Date().toISOString()],
    );
    return true;
  });
}
