/*
 * Full state snapshot — every collection mapped from the normalised DB back into
 * the SHARED frontend types (names resolved from lookup ids, defect columns nested,
 * etc.). The frontend store hydrates from this and renders every read screen
 * through its existing selectors. Dates serialise to ISO strings over HTTP.
 */

import { pool } from "../db.ts";
import { loadSettings } from "./settings.ts";
import type {
  Approval,
  AuditEntry,
  Batch,
  Client,
  ContainerAllocation,
  DocumentRecord,
  ExpenseLine,
  ForexSnapshot,
  Notification,
  ProcessingRecord,
  QualityMetrics,
  Settings,
  Shipment,
  Supplier,
  User,
} from "../domain.ts";

export interface SnapshotState {
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

/* eslint-disable @typescript-eslint/no-explicit-any */
const q = async (sql: string): Promise<any[]> => (await pool.query(sql)).rows;

export async function loadSnapshot(): Promise<SnapshotState> {
  const [
    users,
    suppliers,
    clients,
    batches,
    quality,
    expenses,
    processing,
    forex,
    shipments,
    allocations,
    documents,
    approvals,
    notifications,
    audit,
    settings,
  ] = await Promise.all([
    q(`SELECT id, name, email, phone, role, active, created_at,
              COALESCE(created_by::text,'') AS created_by, updated_at
         FROM users ORDER BY created_at`),
    q(`SELECT s.id, s.name, s.type, d.name AS origin_district, s.contact,
              s.gps_lat, s.gps_lng, s.created_at, s.created_by, s.updated_at
         FROM suppliers s JOIN districts d ON d.id = s.district_id ORDER BY s.name`),
    q(`SELECT * FROM clients ORDER BY name`),
    q(`SELECT b.id, b.batch_code, b.supplier_id, d.name AS origin_district,
              g.name AS coffee_grade, b.parent_batch_id, b.status,
              b.gross_weight_kg, b.tare_weight_kg, b.net_payable_weight_kg,
              b.clean_output_kg, b.buyer_id, b.market_price_per_kg,
              b.created_at, b.created_by, b.updated_at
         FROM batches b
         JOIN districts d ON d.id = b.district_id
         JOIN coffee_grades g ON g.id = b.grade_id
        ORDER BY b.created_at DESC`),
    q(`SELECT q.*, g.name AS recommended_grade
         FROM quality_metrics q JOIN coffee_grades g ON g.id = q.recommended_grade_id`),
    q(`SELECT e.*, c.name AS category
         FROM expense_lines e JOIN expense_categories c ON c.id = e.category_id`),
    q(`SELECT * FROM processing_records`),
    q(`SELECT * FROM forex_snapshots`),
    q(`SELECT * FROM shipments`),
    q(`SELECT * FROM container_allocations`),
    q(`SELECT * FROM documents`),
    q(`SELECT * FROM approvals`),
    q(`SELECT id, type, severity, message, target_role, target_user,
              entity_id AS entity_ref, read, created_at, created_by, updated_at
         FROM notifications`),
    q(`SELECT id, actor, action, (entity_type || ':' || entity_id) AS entity,
              field, old_value, new_value, at, created_at
         FROM audit_log`),
    loadSettings(),
  ]);

  return {
    users: users as User[],
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      origin_district: s.origin_district,
      contact: s.contact,
      gps:
        s.gps_lat != null && s.gps_lng != null
          ? { lat: s.gps_lat, lng: s.gps_lng }
          : undefined,
      created_at: s.created_at,
      created_by: s.created_by,
      updated_at: s.updated_at ?? undefined,
    })) as Supplier[],
    clients: clients as Client[],
    batches: batches as Batch[],
    quality: quality.map((x) => ({
      id: x.id,
      batch_id: x.batch_id,
      moisture_pct: x.moisture_pct,
      fallen_matter_pct: x.fallen_matter_pct,
      defect_pct: x.defect_pct,
      defect_breakdown: {
        black_beans_pct: x.black_beans_pct,
        broken_pct: x.broken_pct,
        husks_pct: x.husks_pct,
        insect_damage_pct: x.insect_damage_pct,
        foreign_matter_pct: x.foreign_matter_pct,
      },
      defect_handling_mode: x.defect_handling_mode,
      recommended_grade: x.recommended_grade,
      graded_by: x.graded_by,
      graded_at: x.graded_at,
      created_at: x.created_at,
      created_by: x.created_by,
      updated_at: x.updated_at ?? undefined,
    })) as QualityMetrics[],
    expenses: expenses as ExpenseLine[],
    processing: processing as ProcessingRecord[],
    forex: forex as ForexSnapshot[],
    shipments: shipments as Shipment[],
    allocations: allocations as ContainerAllocation[],
    documents: documents as DocumentRecord[],
    approvals: approvals as Approval[],
    notifications: notifications as Notification[],
    audit: audit as AuditEntry[],
    settings,
  };
}
