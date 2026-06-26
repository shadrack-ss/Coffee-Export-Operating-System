import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listBatches, getBatch, voidBatch } from "../repos/batches.ts";

export default async function batchRoutes(app: FastifyInstance) {
  // Any authenticated user may read batches.
  app.get(
    "/batches",
    { preHandler: [app.authenticate] },
    async () => ({ batches: await listBatches() }),
  );

  app.get(
    "/batches/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const batch = await getBatch(id);
      if (!batch) return reply.code(404).send({ error: "not_found" });
      return batch;
    },
  );

  const voidBody = z.object({ reason: z.string().min(3) });

  app.post(
    "/batches/:id/void",
    { preHandler: [app.requirePermission("batches.void")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = voidBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
      const batch = await voidBatch(id, req.user.sub, parsed.data.reason);
      if (!batch) return reply.code(404).send({ error: "not_found_or_already_voided" });
      return batch;
    },
  );
}
