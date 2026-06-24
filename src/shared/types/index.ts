/*
 * CE-OS domain model (frontend mirror of the eventual Postgres schema).
 *
 * Every entity carries id / created_at / created_by; updated_at where mutable.
 * Monetary values are integer UGX unless suffixed _usd. Weights are kg numbers.
 *
 * This file is the single source of truth for shapes the UI binds to. When the
 * Supabase backend lands, these become the generated DB types and the financial
 * functions in lib/calc move into Postgres RPC — the shapes carry over.
 */

/*
 * Enum-like domains are declared as `const` arrays and the union type derived
 * from them. This makes them the single source of truth AND introspectable at
 * runtime, so scripts/check-schema.ts can prove they match the Postgres
 * `CREATE TYPE ... AS ENUM` definitions in db/schema.sql. Keep the order/labels
 * in lockstep with the DB enums.
 */

export const ROLES = ["grader", "accountant", "admin", "auditor"] as const;
export type Role = (typeof ROLES)[number];

export const SUPPLIER_TYPES = [
  "farmer",
  "agent",
  "cooperative",
  "washing_station",
  "trader",
] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

export const BATCH_STATUSES = [
  "received",
  "graded",
  "costed",
  "processed",
  "approved",
  "allocated",
  "exported",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const DEFECT_HANDLING_MODES = ["weight", "discount"] as const;
export type DefectHandlingMode = (typeof DEFECT_HANDLING_MODES)[number];

export const EXPENSE_BASES = ["per_kg", "allocated"] as const;
export type ExpenseBasis = (typeof EXPENSE_BASES)[number];

export const PROCESS_TYPES = [
  "hulling",
  "cleaning",
  "sorting",
  "drying",
  "re-grading",
  "re-bagging",
] as const;
export type ProcessType = (typeof PROCESS_TYPES)[number];

export const SEVERITIES = ["info", "watch", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FM_BASES = ["after_mc", "net_physical"] as const;
export type FmBase = (typeof FM_BASES)[number];

export interface Base {
  id: string;
  created_at: string;
  created_by: string;
  updated_at?: string;
}

export interface User extends Base {
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  active: boolean;
}

export interface Supplier extends Base {
  name: string;
  type: SupplierType;
  origin_district: string;
  contact: string;
  gps?: { lat: number; lng: number };
}

export interface Batch extends Base {
  batch_code: string;
  supplier_id: string;
  origin_district: string;
  coffee_grade: string;
  parent_batch_id: string | null;
  status: BatchStatus;
  gross_weight_kg: number;
  tare_weight_kg: number;
  /** computed at grading time, persisted */
  net_payable_weight_kg: number | null;
  /** after processing into a child batch */
  clean_output_kg: number | null;
  buyer_id: string | null;
  /** UGX/kg agreed with the farmer at intake */
  market_price_per_kg: number;
}

export interface QualityMetrics extends Base {
  batch_id: string;
  moisture_pct: number;
  fallen_matter_pct: number;
  defect_pct: number;
  defect_breakdown: {
    black_beans_pct: number;
    broken_pct: number;
    husks_pct: number;
    insect_damage_pct: number;
    foreign_matter_pct: number;
  };
  defect_handling_mode: DefectHandlingMode;
  recommended_grade: string;
  graded_by: string;
  graded_at: string;
}

export interface ExpenseLine extends Base {
  batch_id: string | null;
  category: string;
  amount_ugx: number;
  basis: ExpenseBasis;
  allocation_group_id: string | null;
  note?: string;
  added_by: string;
}

export interface ProcessingRecord extends Base {
  input_batch_id: string;
  output_batch_id: string;
  input_kg: number;
  output_kg: number;
  yield_pct: number;
  loss_kg: number;
  process_type: ProcessType;
}

export interface ForexSnapshot extends Base {
  batch_id: string | null;
  usd_ugx_rate: number;
  source: string;
  captured_at: string;
}

export interface Client extends Base {
  name: string;
  country: string;
  email: string;
  segment: string;
}

export interface Shipment extends Base {
  container_no: string;
  seal_no: string;
  buyer_id: string;
  destination_country: string;
}

export interface ContainerAllocation extends Base {
  shipment_id: string;
  batch_id: string;
  qty_kg: number;
}

export interface DocumentRecord extends Base {
  batch_id: string | null;
  shipment_id: string | null;
  type: string;
  file_url: string;
  generated_at: string;
}

export interface Approval extends Base {
  batch_id: string;
  approved_by: string;
  approved_at: string;
  amount_ugx: number;
}

export interface Notification extends Base {
  type: string;
  severity: Severity;
  message: string;
  target_role: Role | null;
  target_user: string | null;
  entity_ref: string | null;
  read: boolean;
}

export interface AuditEntry extends Base {
  actor: string;
  action: string;
  entity: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  at: string;
}

/** Single-row configurable standards + managed lists. */
export interface Settings {
  // quality standards
  mc_standard_pct: number; // [14]
  fm_standard_pct: number; // [0.5]
  defect_standard_pct: number; // [4]
  default_defect_handling: DefectHandlingMode; // "weight"
  /** does FM deduct off moisture-adjusted weight, or off net physical? */
  fm_base: FmBase;

  // per-kg cost defaults (UGX/kg unless noted)
  ura_tax_pct: number; // [2] of purchase price
  handling_per_kg: number; // [100]
  gunny_bags_per_kg: number; // [109] USD-linked
  gunny_bags_usd_ref_rate: number; // rate at which gunny_bags_per_kg was set
  paperwork_per_kg: number; // [50]

  // financial
  target_margin_pct: number; // for risk flagging

  // managed lists (never free text)
  coffee_grades: string[];
  districts: string[];
  expense_categories: string[];
}

/**
 * The full application data aggregate — every collection + settings. The
 * frontend store holds this; the API returns it as the read snapshot. Lives in
 * the shared kernel so both the store and the api client can reference it
 * without importing each other.
 */
export interface DataState {
  users: User[];
  suppliers: Supplier[];
  clients: Client[];
  batches: Batch[];
  quality: QualityMetrics[];
  expenses: ExpenseLine[];
  processing: ProcessingRecord[];
  forex: ForexSnapshot[];
  shipments: Shipment[];
  allocations: ContainerAllocation[];
  documents: DocumentRecord[];
  approvals: Approval[];
  notifications: Notification[];
  audit: AuditEntry[];
  settings: Settings;
}
