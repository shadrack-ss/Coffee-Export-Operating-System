import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { setLiveRate, lockRate } from "../repos/forex.ts";
import { runUraSync } from "../jobs/syncUraRate.ts";

const rateBody = z.object({
  rate: z.number().positive(),
  source: z.string().min(1),
});
const lockBody = z.object({
  batch_id: z.string().uuid(),
  rate: z.number().positive(),
  source: z.string().min(1),
});

export default async function forexRoutes(app: FastifyInstance) {
  app.post(
    "/forex/rate",
    { preHandler: [app.requirePermission("forex.manage")] },
    async (req, reply) => {
      const p = rateBody.safeParse(req.body);
      if (!p.success) return reply.code(400).send({ error: "invalid_body" });
      await setLiveRate(p.data.rate, p.data.source, req.user.sub);
      return reply.code(201).send({ ok: true });
    },
  );

  app.post(
    "/forex/sync-ura",
    { preHandler: [app.requirePermission("forex.manage")] },
    async (_req, reply) => {
      // Fire and forget — scrape is slow (15–25 s). Return immediately so
      // proxies and browsers don't time out. Client polls /state for the result.
      runUraSync(app.log).catch((err: unknown) => {
        app.log.error(err instanceof Error ? err.message : String(err));
      });
      return reply.code(202).send({ ok: true, status: "started" });
    },
  );

  app.post(
    "/forex/lock",
    { preHandler: [app.requirePermission("forex.manage")] },
    async (req, reply) => {
      const p = lockBody.safeParse(req.body);
      if (!p.success) return reply.code(400).send({ error: "invalid_body" });
      await lockRate(p.data.batch_id, p.data.rate, p.data.source, req.user.sub);
      return reply.code(201).send({ ok: true });
    },
  );
}
