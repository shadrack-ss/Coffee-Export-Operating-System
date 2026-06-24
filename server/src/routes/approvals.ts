import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { approveBatch } from "../repos/approvals.ts";

const body = z.object({ batch_id: z.string().uuid() });

export default async function approvalRoutes(app: FastifyInstance) {
  app.post(
    "/approvals",
    { preHandler: [app.requirePermission("payment.approve")] },
    async (req, reply) => {
      const parsed = body.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body" });
      }
      try {
        const result = await approveBatch(parsed.data.batch_id, req.user.sub);
        return reply.code(201).send(result);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );
}
