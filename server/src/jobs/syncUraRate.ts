/*
 * Background job: poll the URA Exports rate every 30 minutes and persist it.
 * Also runs once on server startup so the rate is fresh after a restart.
 *
 * URA publishes one rate per day, so we only save a new snapshot when the rate
 * actually changed — this keeps the rate-history chart clean instead of piling
 * up identical points every half hour.
 */
import { fetchUraExportsRate } from "../services/uraRate.ts";
import { setLiveRate, resolveSystemActor, getLatestRate } from "../repos/forex.ts";

const INTERVAL_MS = 60 * 60 * 1000; // every hour

export async function runUraSync(log: { info: (s: string) => void; warn: (s: string) => void }) {
  log.info("URA rate sync: starting");
  const result = await fetchUraExportsRate();
  if (result.ok && result.rate) {
    const current = await getLatestRate();
    if (current !== null && current === result.rate) {
      log.info(`URA rate sync: rate unchanged (${result.rate}) — no new snapshot`);
      return result;
    }
    const actor = await resolveSystemActor();
    if (!actor) {
      log.warn("URA rate sync: no admin user found to attribute the rate to — skipping save.");
      return { ok: false, error: "No admin user available to record the rate." };
    }
    await setLiveRate(result.rate, "URA Exports (auto)", actor);
    log.info(`URA rate sync: saved ${result.rate} for ${result.date}`);
  } else {
    log.warn(`URA rate sync failed: ${result.error}`);
  }
  return result;
}

export function startUraRateSyncJob(log: {
  info: (s: string) => void;
  warn: (s: string) => void;
}) {
  // Run once at startup (catches restarts), then poll on a fixed interval.
  runUraSync(log).catch(() => {});
  log.info(`URA rate sync: polling every ${INTERVAL_MS / 60000} minutes`);
  setInterval(() => {
    runUraSync(log).catch(() => {});
  }, INTERVAL_MS);
}
