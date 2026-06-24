import type { FastifyInstance } from "fastify";
import { listBatches, getBatch } from "../repos/batches.ts";

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
}
