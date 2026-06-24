import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createUser, updateUser, deactivateUser, resetUserPassword } from "../repos/users.ts";

const ROLES = ["grader", "accountant", "admin", "auditor"] as const;

const createBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7).optional().nullable(),
  role: z.enum(ROLES),
  temp_password: z.string().min(8),
});

const updateBody = z
  .object({
    name: z.string().min(2).optional(),
    role: z.enum(ROLES).optional(),
  })
  .refine((d) => d.name !== undefined || d.role !== undefined, {
    message: "provide name or role",
  });

const resetPasswordBody = z.object({
  temp_password: z.string().min(8),
});

export default async function userRoutes(app: FastifyInstance) {
  app.post(
    "/users",
    { preHandler: [app.requirePermission("users.manage")] },
    async (req, reply) => {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      try {
        const user = await createUser({ ...parsed.data, actor: req.user.sub });
        return reply.code(201).send(user);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err as Error;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );

  app.put(
    "/users/:id",
    { preHandler: [app.requirePermission("users.manage")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateBody.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_body" });
      try {
        const user = await updateUser({ id, ...parsed.data, actor: req.user.sub });
        return reply.send(user);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err as Error;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );

  app.post(
    "/users/:id/reset-password",
    { preHandler: [app.requirePermission("users.manage")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = resetPasswordBody.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_body" });
      try {
        const result = await resetUserPassword(id, parsed.data.temp_password, req.user.sub);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err as Error;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );

  app.delete(
    "/users/:id",
    { preHandler: [app.requirePermission("users.manage")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        const result = await deactivateUser(id, req.user.sub);
        return reply.send(result);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err as Error;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );
}
