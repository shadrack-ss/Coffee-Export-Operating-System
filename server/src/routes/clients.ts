import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createClient, updateClient } from "../repos/clients.ts";

const clientBody = z.object({
  name: z.string().min(2),
  country: z.string().min(2),
  email: z.string().email(),
  segment: z.string().min(1),
});

const patchBody = clientBody.partial();

export default async function clientRoutes(app: FastifyInstance) {
  app.post(
    "/clients",
    { preHandler: [app.requirePermission("clients.manage")] },
    async (req, reply) => {
      const parsed = clientBody.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      const client = await createClient({ ...parsed.data, actor: req.user.sub });
      return reply.code(201).send(client);
    },
  );

  app.put(
    "/clients/:id",
    { preHandler: [app.requirePermission("clients.manage")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = patchBody.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_body" });
      try {
        const client = await updateClient({ id, ...parsed.data, actor: req.user.sub });
        return reply.send(client);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err as Error;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );
}
