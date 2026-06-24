/*
 * Seed data — realistic Ugandan coffee-export sample so nothing is empty on
 * first load (§2, §8). Three+ suppliers, batches, clients, plus quality,
 * expenses, a shipment, and forex snapshots. IDs are stable strings.
 */

import type {
  Approval,
  AuditEntry,
  Batch,
  Client,
  ContainerAllocation,
  ExpenseLine,
  ForexSnapshot,
  Notification,
  ProcessingRecord,
  QualityMetrics,
  Shipment,
  Supplier,
  User,
} from "@/shared/types";

const now = "2026-06-15T08:00:00.000Z";
const SYS = "u-admin";

export const seedUsers: User[] = [
  { id: "u-admin", name: "Daniel Okello", email: "daniel@ceos.ug", role: "admin", active: true, created_at: now, created_by: "system" },
  { id: "u-grader", name: "Sarah Nakato", email: "sarah@ceos.ug", role: "grader", active: true, created_at: now, created_by: SYS },
  { id: "u-acct", name: "Joseph Mukasa", email: "joseph@ceos.ug", role: "accountant", active: true, created_at: now, created_by: SYS },
  { id: "u-audit", name: "Grace Auma", email: "grace@ceos.ug", role: "auditor", active: true, created_at: now, created_by: SYS },
];

export const seedSuppliers: Supplier[] = [
  { id: "s-1", name: "Sipi Falls Cooperative", type: "cooperative", origin_district: "Sipi / Kapchorwa", contact: "+256 772 100 001", gps: { lat: 1.337, lng: 34.371 }, created_at: now, created_by: SYS },
  { id: "s-2", name: "Wamboga Farm", type: "farmer", origin_district: "Mbale", contact: "+256 772 100 002", gps: { lat: 1.082, lng: 34.175 }, created_at: now, created_by: SYS },
  { id: "s-3", name: "Rwenzori Agents Ltd", type: "agent", origin_district: "Kasese", contact: "+256 772 100 003", created_at: now, created_by: SYS },
  { id: "s-4", name: "Masaka Washing Station", type: "washing_station", origin_district: "Masaka", contact: "+256 772 100 004", gps: { lat: -0.341, lng: 31.734 }, created_at: now, created_by: SYS },
];

export const seedClients: Client[] = [
  { id: "c-1", name: "Hamburg Coffee Imports GmbH", country: "Germany", email: "buying@hci.de", segment: "Specialty roaster", created_at: now, created_by: SYS },
  { id: "c-2", name: "Trieste Caffè S.p.A.", country: "Italy", email: "import@triestecaffe.it", segment: "Commercial blend", created_at: now, created_by: SYS },
  { id: "c-3", name: "Antwerp Green Traders", country: "Belgium", email: "desk@antwerpgreen.be", segment: "Trader", created_at: now, created_by: SYS },
];

export const seedBatches: Batch[] = [
  {
    id: "b-1", batch_code: "MBR-2026-0007", supplier_id: "s-1", origin_district: "Sipi / Kapchorwa",
    coffee_grade: "Bugisu AA", parent_batch_id: null, status: "costed",
    gross_weight_kg: 6240, tare_weight_kg: 240, net_payable_weight_kg: 5640,
    clean_output_kg: null, buyer_id: "c-1", market_price_per_kg: 9800,
    created_at: "2026-06-10T09:00:00.000Z", created_by: "u-grader",
  },
  {
    id: "b-2", batch_code: "MBR-2026-0008", supplier_id: "s-2", origin_district: "Mbale",
    coffee_grade: "FAQ", parent_batch_id: null, status: "graded",
    gross_weight_kg: 1040, tare_weight_kg: 40, net_payable_weight_kg: 940,
    clean_output_kg: null, buyer_id: null, market_price_per_kg: 8200,
    created_at: "2026-06-12T11:30:00.000Z", created_by: "u-grader",
  },
  {
    id: "b-3", batch_code: "KSE-2026-0011", supplier_id: "s-3", origin_district: "Kasese",
    coffee_grade: "Robusta Screen 18", parent_batch_id: null, status: "approved",
    gross_weight_kg: 12300, tare_weight_kg: 300, net_payable_weight_kg: 11820,
    clean_output_kg: null, buyer_id: "c-2", market_price_per_kg: 7400,
    created_at: "2026-06-05T07:15:00.000Z", created_by: "u-grader",
  },
  {
    id: "b-4", batch_code: "MSK-2026-0003", supplier_id: "s-4", origin_district: "Masaka",
    coffee_grade: "Kiboko", parent_batch_id: null, status: "received",
    gross_weight_kg: 2080, tare_weight_kg: 80, net_payable_weight_kg: null,
    clean_output_kg: null, buyer_id: null, market_price_per_kg: 5200,
    created_at: "2026-06-15T06:45:00.000Z", created_by: "u-grader",
  },
  // processing child of b-3 (Kiboko -> clean Robusta)
  {
    id: "b-3c", batch_code: "KSE-2026-0011-C", supplier_id: "s-3", origin_district: "Kasese",
    coffee_grade: "Robusta Screen 18", parent_batch_id: "b-3", status: "allocated",
    gross_weight_kg: 10050, tare_weight_kg: 0, net_payable_weight_kg: 10050,
    clean_output_kg: 10050, buyer_id: "c-2", market_price_per_kg: 7400,
    created_at: "2026-06-08T10:00:00.000Z", created_by: "u-grader",
  },
];

export const seedQuality: QualityMetrics[] = [
  {
    id: "q-1", batch_id: "b-1", moisture_pct: 13.5, fallen_matter_pct: 0.5, defect_pct: 3,
    defect_breakdown: { black_beans_pct: 1, broken_pct: 0.8, husks_pct: 0.5, insect_damage_pct: 0.4, foreign_matter_pct: 0.3 },
    defect_handling_mode: "weight", recommended_grade: "Screen 18 (AA)",
    graded_by: "u-grader", graded_at: "2026-06-10T09:30:00.000Z", created_at: "2026-06-10T09:30:00.000Z", created_by: "u-grader",
  },
  {
    id: "q-2", batch_id: "b-2", moisture_pct: 20, fallen_matter_pct: 0.5, defect_pct: 4,
    defect_breakdown: { black_beans_pct: 1.5, broken_pct: 1, husks_pct: 0.7, insect_damage_pct: 0.5, foreign_matter_pct: 0.3 },
    defect_handling_mode: "weight", recommended_grade: "FAQ",
    graded_by: "u-grader", graded_at: "2026-06-12T12:00:00.000Z", created_at: "2026-06-12T12:00:00.000Z", created_by: "u-grader",
  },
  {
    id: "q-3", batch_id: "b-3", moisture_pct: 14.5, fallen_matter_pct: 1, defect_pct: 6,
    defect_breakdown: { black_beans_pct: 2.5, broken_pct: 1.5, husks_pct: 1, insect_damage_pct: 0.6, foreign_matter_pct: 0.4 },
    defect_handling_mode: "weight", recommended_grade: "FAQ",
    graded_by: "u-grader", graded_at: "2026-06-05T08:00:00.000Z", created_at: "2026-06-05T08:00:00.000Z", created_by: "u-grader",
  },
];

export const seedExpenses: ExpenseLine[] = [
  // b-1 allocated transport (group ag-1 spans b-1 + b-3)
  { id: "e-1", batch_id: "b-1", category: "Transport (A4T Kampala)", amount_ugx: 2000000, basis: "allocated", allocation_group_id: "ag-1", note: "Truck UAP-220 to Kampala", added_by: "u-acct", created_at: now, created_by: "u-acct" },
  { id: "e-2", batch_id: "b-3", category: "Transport (A4T Kampala)", amount_ugx: 2000000, basis: "allocated", allocation_group_id: "ag-1", note: "Truck UAP-220 to Kampala", added_by: "u-acct", created_at: now, created_by: "u-acct" },
  { id: "e-3", batch_id: "b-3", category: "Storage", amount_ugx: 450000, basis: "allocated", allocation_group_id: "ag-2", note: "3 weeks warehouse", added_by: "u-acct", created_at: now, created_by: "u-acct" },
  { id: "e-4", batch_id: "b-3", category: "Inspection", amount_ugx: 300000, basis: "allocated", allocation_group_id: "ag-3", note: "UCDA inspection", added_by: "u-acct", created_at: now, created_by: "u-acct" },
];

export const seedProcessing: ProcessingRecord[] = [
  { id: "p-1", input_batch_id: "b-3", output_batch_id: "b-3c", input_kg: 11820, output_kg: 10050, yield_pct: 85.03, loss_kg: 1770, process_type: "hulling", created_at: "2026-06-08T10:00:00.000Z", created_by: "u-grader" },
];

export const seedForex: ForexSnapshot[] = [
  { id: "f-live", batch_id: null, usd_ugx_rate: 3805, source: "ExchangeRate-API", captured_at: "2026-06-17T06:00:00.000Z", created_at: "2026-06-17T06:00:00.000Z", created_by: "system" },
  { id: "f-b1", batch_id: "b-1", usd_ugx_rate: 3760, source: "locked at costing", captured_at: "2026-06-10T10:00:00.000Z", created_at: "2026-06-10T10:00:00.000Z", created_by: "u-acct" },
  { id: "f-b3", batch_id: "b-3", usd_ugx_rate: 3690, source: "locked at costing", captured_at: "2026-06-05T09:00:00.000Z", created_at: "2026-06-05T09:00:00.000Z", created_by: "u-acct" },
];

export const seedShipments: Shipment[] = [
  { id: "sh-1", container_no: "MSC-2847", seal_no: "UG-77120", buyer_id: "c-1", destination_country: "Germany", created_at: now, created_by: SYS },
];

export const seedAllocations: ContainerAllocation[] = [
  { id: "ca-1", shipment_id: "sh-1", batch_id: "b-3c", qty_kg: 10050, created_at: now, created_by: SYS },
  { id: "ca-2", shipment_id: "sh-1", batch_id: "b-1", qty_kg: 5640, created_at: now, created_by: SYS },
];

export const seedApprovals: Approval[] = [
  { id: "ap-1", batch_id: "b-3", approved_by: "u-admin", approved_at: "2026-06-06T09:00:00.000Z", amount_ugx: 87468000, created_at: "2026-06-06T09:00:00.000Z", created_by: "u-admin" },
];

export const seedNotifications: Notification[] = [
  { id: "n-1", type: "high_moisture", severity: "watch", message: "MBR-2026-0008 graded at 20% moisture — 6% weight deduction applied.", target_role: "grader", target_user: null, entity_ref: "b-2", read: false, created_at: "2026-06-12T12:01:00.000Z", created_by: "system" },
  { id: "n-2", type: "forex_risk", severity: "critical", message: "MBR-2026-0007 below target-margin rate (needs 3,9xx; live 3,805).", target_role: "admin", target_user: null, entity_ref: "b-1", read: false, created_at: "2026-06-17T06:05:00.000Z", created_by: "system" },
  { id: "n-3", type: "pending_approval", severity: "info", message: "MSK-2026-0003 received — awaiting grading then costing.", target_role: "admin", target_user: null, entity_ref: "b-4", read: true, created_at: "2026-06-15T07:00:00.000Z", created_by: "system" },
];

export const seedAudit: AuditEntry[] = [
  { id: "al-1", actor: "u-admin", action: "approve_payment", entity: "batch:b-3", field: "status", old_value: "costed", new_value: "approved", at: "2026-06-06T09:00:00.000Z", created_at: "2026-06-06T09:00:00.000Z", created_by: "u-admin" },
  { id: "al-2", actor: "u-grader", action: "create_grn", entity: "batch:b-2", field: null, old_value: null, new_value: "MBR-2026-0008", at: "2026-06-12T12:00:00.000Z", created_at: "2026-06-12T12:00:00.000Z", created_by: "u-grader" },
  { id: "al-3", actor: "u-acct", action: "add_expense", entity: "batch:b-1", field: "amount_ugx", old_value: null, new_value: "2000000", at: now, created_at: now, created_by: "u-acct" },
];
