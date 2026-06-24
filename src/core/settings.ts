import type { Settings } from "@/shared/types";

/** Default configurable standards — all editable in Settings (§5, §8). */
export const DEFAULT_SETTINGS: Settings = {
  mc_standard_pct: 14,
  fm_standard_pct: 0.5,
  defect_standard_pct: 4,
  default_defect_handling: "weight",
  fm_base: "after_mc",

  ura_tax_pct: 2,
  handling_per_kg: 100,
  gunny_bags_per_kg: 109,
  gunny_bags_usd_ref_rate: 3800,
  paperwork_per_kg: 50,

  target_margin_pct: 12,

  coffee_grades: [
    "Kiboko",
    "FAQ",
    "Screen 18 (AA)",
    "Screen 15 (AB)",
    "Commercial",
    "Bugisu AA",
    "Robusta Screen 18",
  ],
  districts: [
    "Mbale",
    "Sipi / Kapchorwa",
    "Kasese",
    "Bushenyi",
    "Luwero",
    "Masaka",
    "Mityana",
    "Kween",
  ],
  expense_categories: [
    "URA tax",
    "Handling",
    "Gunny bags",
    "Paperwork",
    "Transport (A4T Kampala)",
    "Transport (A4B Mombasa)",
    "Port fees",
    "Inspection",
    "Storage",
    "Insurance",
  ],
};
