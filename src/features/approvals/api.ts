/*
 * Approvals feature write-logic — approve a batch's outgoing cash via POST /approvals.
 */

import { api } from "@/core/api";

/** Approve via the live API. */
export function useApproveBatchApi() {
  return (batchId: string) => api.approve(batchId);
}
