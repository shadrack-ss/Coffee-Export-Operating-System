import { buildApp } from "./app.ts";
import { config } from "./config.ts";
import { startUraRateSyncJob } from "./jobs/syncUraRate.ts";

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  startUraRateSyncJob(app.log);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
