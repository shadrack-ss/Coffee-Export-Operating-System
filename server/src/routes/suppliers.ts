import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSupplier, updateSupplier } from "../repos/suppliers.ts";

const SUPPLIER_TYPES = ["farmer", "agent", "cooperative", "washing_station", "trader"] as const;

const supplierBody = z.object({
  name: z.string().min(2),
  type: z.enum(SUPPLIER_TYPES),
  district_id: z.number().int().positive(),
  contact: z.string().min(1),
  gps_lat: z.number().min(-90).max(90).nullable().optional(),
  gps_lng: z.number().min(-180).max(180).nullable().optional(),
});

const patchBody = supplierBody.partial();

export default async function supplierRoutes(app: FastifyInstance) {
  app.post(
    "/suppliers",
    { preHandler: [app.requirePermission("suppliers.manage")] },
    async (req, reply) => {
      const parsed = supplierBody.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      const supplier = await createSupplier({ ...parsed.data, actor: req.user.sub });
      return reply.code(201).send(supplier);
    },
  );

  app.put(
    "/suppliers/:id",
    { preHandler: [app.requirePermission("suppliers.manage")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = patchBody.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_body" });
      try {
        const supplier = await updateSupplier({ id, ...parsed.data, actor: req.user.sub });
        return reply.send(supplier);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err as Error;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );
}
