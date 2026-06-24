import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createShipment, allocateBatch } from "../repos/shipments.ts";

const shipmentBody = z.object({
  container_no: z.string().min(1),
  seal_no: z.string().min(1),
  buyer_id: z.string().uuid(),
  destination_country: z.string().min(2),
});

const allocationBody = z.object({
  batch_id: z.string().uuid(),
  qty_kg: z.number().positive(),
});

export default async function shipmentRoutes(app: FastifyInstance) {
  app.post(
    "/shipments",
    { preHandler: [app.requirePermission("payment.approve")] },
    async (req, reply) => {
      const parsed = shipmentBody.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      try {
        const shipment = await createShipment({ ...parsed.data, actor: req.user.sub });
        return reply.code(201).send(shipment);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err as Error;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );

  app.post(
    "/shipments/:id/allocations",
    { preHandler: [app.requirePermission("payment.approve")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = allocationBody.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_body" });
      try {
        const allocation = await allocateBatch({
          shipment_id: id,
          ...parsed.data,
          actor: req.user.sub,
        });
        return reply.code(201).send(allocation);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err as Error;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );
}
