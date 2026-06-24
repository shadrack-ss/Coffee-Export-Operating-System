/* Reference / lookup data the GRN form needs (suppliers + managed lists). */

import { pool } from "../db.ts";

export interface SupplierRef {
  id: string;
  name: string;
  type: string;
  district_id: number;
}
export interface LookupRow {
  id: number;
  name: string;
}

export async function listSuppliers(): Promise<SupplierRef[]> {
  const { rows } = await pool.query<SupplierRef>(
    `SELECT id, name, type, district_id FROM suppliers ORDER BY name`,
  );
  return rows;
}

export async function listDistricts(): Promise<LookupRow[]> {
  const { rows } = await pool.query<LookupRow>(
    `SELECT id, name FROM districts ORDER BY id`,
  );
  return rows;
}

export async function listGrades(): Promise<LookupRow[]> {
  const { rows } = await pool.query<LookupRow>(
    `SELECT id, name FROM coffee_grades WHERE active AND sellable ORDER BY id`,
  );
  return rows;
}
