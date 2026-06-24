import type { FastifyInstance } from "fastify";
import { loadSnapshot } from "../repos/snapshot.ts";

export default async function snapshotRoutes(app: FastifyInstance) {
  // Full read snapshot the frontend store hydrates from (authenticated).
  app.get("/state", async () => loadSnapshot());
}
