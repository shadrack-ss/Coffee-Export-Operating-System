/* Loads the single settings row + managed lists into the shared Settings shape. */

import { pool } from "../db.ts";
import type { Settings, DefectHandlingMode, FmBase } from "../domain.ts";

/** The editable numeric/standard fields of settings (not the managed lists). */
export interface SettingsPatch {
  mc_standard_pct: number;
  fm_standard_pct: number;
  defect_standard_pct: number;
  default_defect_handling: DefectHandlingMode;
  fm_base: FmBase;
  ura_tax_pct: number;
  handling_per_kg: number;
  gunny_bags_per_kg: number;
  gunny_bags_usd_ref_rate: number;
  paperwork_per_kg: number;
  target_margin_pct: number;
}

export async function updateSettings(p: SettingsPatch): Promise<void> {
  await pool.query(
    `UPDATE settings SET
       mc_standard_pct = $1, fm_standard_pct = $2, defect_standard_pct = $3,
       default_defect_handling = $4, fm_base = $5, ura_tax_pct = $6,
       handling_per_kg = $7, gunny_bags_per_kg = $8, gunny_bags_usd_ref_rate = $9,
       paperwork_per_kg = $10, target_margin_pct = $11
     WHERE id = 1`,
    [
      p.mc_standard_pct,
      p.fm_standard_pct,
      p.defect_standard_pct,
      p.default_defect_handling,
      p.fm_base,
      p.ura_tax_pct,
      p.handling_per_kg,
      p.gunny_bags_per_kg,
      p.gunny_bags_usd_ref_rate,
      p.paperwork_per_kg,
      p.target_margin_pct,
    ],
  );
}

interface SettingsRow {
  mc_standard_pct: number;
  fm_standard_pct: number;
  defect_standard_pct: number;
  default_defect_handling: DefectHandlingMode;
  fm_base: FmBase;
  ura_tax_pct: number;
  handling_per_kg: number;
  gunny_bags_per_kg: number;
  gunny_bags_usd_ref_rate: number;
  paperwork_per_kg: number;
  target_margin_pct: number;
}

export async function loadSettings(): Promise<Settings> {
  const [{ rows: srows }, grades, districts, categories] = await Promise.all([
    pool.query<SettingsRow>(`SELECT * FROM settings WHERE id = 1`),
    pool.query<{ name: string }>(
      `SELECT name FROM coffee_grades WHERE active AND sellable ORDER BY id`,
    ),
    pool.query<{ name: string }>(`SELECT name FROM districts ORDER BY id`),
    pool.query<{ name: string }>(
      `SELECT name FROM expense_categories WHERE active ORDER BY id`,
    ),
  ]);
  const s = srows[0];
  return {
    mc_standard_pct: s.mc_standard_pct,
    fm_standard_pct: s.fm_standard_pct,
    defect_standard_pct: s.defect_standard_pct,
    default_defect_handling: s.default_defect_handling,
    fm_base: s.fm_base,
    ura_tax_pct: s.ura_tax_pct,
    handling_per_kg: s.handling_per_kg,
    gunny_bags_per_kg: s.gunny_bags_per_kg,
    gunny_bags_usd_ref_rate: s.gunny_bags_usd_ref_rate,
    paperwork_per_kg: s.paperwork_per_kg,
    target_margin_pct: s.target_margin_pct,
    coffee_grades: grades.rows.map((r) => r.name),
    districts: districts.rows.map((r) => r.name),
    expense_categories: categories.rows.map((r) => r.name),
  };
}
