/*
 * Traceability selectors — the differentiator (§5.5).
 *
 * Forward:  Farmer → GRN/Batch → Processing (parent→child) → Container → Buyer.
 * Reverse:  given a container, every contributing batch with its source farmer,
 *           district and quality — "whose coffee is in container MSC-2847?"
 *
 * parent_batch_id carries splits/merges through processing; container_allocations
 * lets one container draw from multiple batches.
 */

import type {
  Batch,
  Client,
  ContainerAllocation,
  QualityMetrics,
  Shipment,
  Supplier,
} from "@/shared/types";
import type { DataState } from "@/core/store";

export interface Contribution {
  allocation: ContainerAllocation;
  batch: Batch;
  supplier?: Supplier;
  quality?: QualityMetrics;
  /** the original intake this (possibly processed) batch traces back to */
  rootBatch: Batch;
  rootQuality?: QualityMetrics;
}

/** Walk parent_batch_id up to the original intake. */
export function rootIntake(batch: Batch, batches: Batch[]): Batch {
  let cur = batch;
  const seen = new Set<string>();
  while (cur.parent_batch_id && !seen.has(cur.id)) {
    seen.add(cur.id);
    const parent = batches.find((b) => b.id === cur.parent_batch_id);
    if (!parent) break;
    cur = parent;
  }
  return cur;
}

/** THE reverse query: contributors to a container/shipment. */
export function containerContributions(
  shipmentId: string,
  state: DataState,
): Contribution[] {
  return state.allocations
    .filter((a) => a.shipment_id === shipmentId)
    .map((allocation) => {
      const batch = state.batches.find((b) => b.id === allocation.batch_id)!;
      const root = batch ? rootIntake(batch, state.batches) : batch;
      return {
        allocation,
        batch,
        supplier: state.suppliers.find((s) => s.id === batch?.supplier_id),
        quality: state.quality.find((q) => q.batch_id === batch?.id),
        rootBatch: root,
        rootQuality: state.quality.find((q) => q.batch_id === root?.id),
      };
    })
    .filter((c) => !!c.batch);
}

export interface ChainNode {
  key: string;
  stage: string;
  title: string;
  subtitle?: string;
  to?: string;
  meta?: string;
}

/** Forward chain for a single batch, as an ordered list of stage nodes. */
export function batchChain(batch: Batch, state: DataState): ChainNode[] {
  const nodes: ChainNode[] = [];
  const supplier = state.suppliers.find((s) => s.id === batch.supplier_id);
  const root = rootIntake(batch, state.batches);

  if (supplier) {
    nodes.push({
      key: "supplier",
      stage: "Source",
      title: supplier.name,
      subtitle: `${supplier.type.replace(/_/g, " ")} · ${supplier.origin_district}`,
      meta: supplier.gps ? `${supplier.gps.lat}, ${supplier.gps.lng}` : undefined,
    });
  }

  nodes.push({
    key: "intake",
    stage: "Intake / GRN",
    title: root.batch_code,
    subtitle: root.coffee_grade,
    to: `/batches/${root.id}`,
  });

  // processing chain from root down to this batch
  const lineage: Batch[] = [];
  let cur: Batch | undefined = batch;
  const seen = new Set<string>();
  while (cur && cur.id !== root.id && !seen.has(cur.id)) {
    seen.add(cur.id);
    lineage.unshift(cur);
    cur = state.batches.find((b) => b.id === cur!.parent_batch_id);
  }
  for (const child of lineage) {
    const rec = state.processing.find((p) => p.output_batch_id === child.id);
    nodes.push({
      key: `proc-${child.id}`,
      stage: "Processing",
      title: child.batch_code,
      subtitle: rec
        ? `${rec.process_type.replace(/-/g, " ")} · yield ${rec.yield_pct}%`
        : "processed",
      to: `/batches/${child.id}`,
    });
  }

  // containers this batch is allocated to
  const allocs = state.allocations.filter((a) => a.batch_id === batch.id);
  for (const a of allocs) {
    const shipment = state.shipments.find((s) => s.id === a.shipment_id);
    const buyer = shipment
      ? state.clients.find((c) => c.id === shipment.buyer_id)
      : undefined;
    if (shipment) {
      nodes.push({
        key: `ship-${shipment.id}`,
        stage: "Export container",
        title: shipment.container_no,
        subtitle: `seal ${shipment.seal_no} · ${a.qty_kg} kg`,
      });
      if (buyer) {
        nodes.push({
          key: `buyer-${buyer.id}`,
          stage: "Buyer",
          title: buyer.name,
          subtitle: `${buyer.country} · ${buyer.segment}`,
        });
      }
    }
  }

  return nodes;
}

export interface ShipmentSummary {
  shipment: Shipment;
  buyer?: Client;
  totalKg: number;
  batchCount: number;
}

export function shipmentSummaries(state: DataState): ShipmentSummary[] {
  return state.shipments.map((shipment) => {
    const allocs = state.allocations.filter(
      (a) => a.shipment_id === shipment.id,
    );
    return {
      shipment,
      buyer: state.clients.find((c) => c.id === shipment.buyer_id),
      totalKg: allocs.reduce((s, a) => s + a.qty_kg, 0),
      batchCount: allocs.length,
    };
  });
}
