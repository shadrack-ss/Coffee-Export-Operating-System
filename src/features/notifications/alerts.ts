/*
 * Live alerts derived from current state + live rate (§5.7). Unlike stored
 * notifications these always reflect *now* — a rate move flips them without an
 * event. The bell merges these with stored notifications.
 *
 * Depends on the batches read-model via its public API — a sanctioned
 * cross-feature dependency (notifications → batches), not a deep import.
 */

import { allBatchFinancials } from "@/features/batches";
import type { DataState } from "@/core/store";
import type { Severity } from "@/shared/types";

export interface LiveAlert {
  id: string;
  type: "forex_risk" | "negative_margin" | "pending_approval";
  severity: Severity;
  message: string;
  entity_ref: string;
}

export function deriveAlerts(state: DataState, liveRate: number): LiveAlert[] {
  const alerts: LiveAlert[] = [];
  const fin = allBatchFinancials(state, liveRate);

  for (const f of fin) {
    if (f.revenue_ugx <= 0) continue;
    if (f.profit_loss_ugx < 0) {
      alerts.push({
        id: `alert-loss-${f.batch.id}`,
        type: "negative_margin",
        severity: "critical",
        message: `${f.batch.batch_code} is loss-making at the live rate — margin ${f.margin_pct}%.`,
        entity_ref: f.batch.id,
      });
    } else if (f.risk === "watch") {
      alerts.push({
        id: `alert-fx-${f.batch.id}`,
        type: "forex_risk",
        severity: "watch",
        message: `${f.batch.batch_code} is below the rate needed for target margin (${state.settings.target_margin_pct}%).`,
        entity_ref: f.batch.id,
      });
    }
  }

  // Batches costed and awaiting cash approval → flag to admins.
  for (const b of state.batches) {
    if (b.status === "costed") {
      alerts.push({
        id: `alert-approve-${b.id}`,
        type: "pending_approval",
        severity: "info",
        message: `${b.batch_code} is costed and awaiting cash approval.`,
        entity_ref: b.id,
      });
    }
  }

  return alerts;
}
