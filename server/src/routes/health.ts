import type { FastifyInstance } from "fastify";
import { pool } from "../db.ts";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", { config: { public: true } }, async () => {
    await pool.query("SELECT 1");
    return { ok: true, ts: new Date().toISOString() };
  });
}
