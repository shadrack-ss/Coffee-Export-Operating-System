/*
 * Forex feature write-logic — global rate snapshots & per-batch rate locking.
 */

import { api } from "@/core/api";

/** Persist a global rate snapshot via the live API. */
export function useSetLiveRateApi() {
  return (rate: number, source: string) => api.setLiveRate(rate, source);
}

/** Lock a rate to a batch via the live API. */
export function useLockRateApi() {
  return (batchId: string, rate: number, source: string) =>
    api.lockRate(batchId, rate, source);
}

/** Trigger a live URA Exports rate scrape on the server. */
export function useSyncUraRateApi() {
  return () => api.syncUraRate();
}
