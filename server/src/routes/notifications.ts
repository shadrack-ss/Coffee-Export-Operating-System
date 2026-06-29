import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.ts";

const readBody = z.object({ read: z.boolean() });

export default async function notificationRoutes(app: FastifyInstance) {
  // Toggle read state on a single notification
  app.patch(
    "/notifications/:id/read",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = readBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
      await pool.query(
        "UPDATE notifications SET read = $1 WHERE id = $2",
        [parsed.data.read, id],
      );
      return reply.send({ ok: true });
    },
  );

  // Mark every notification as read
  app.patch(
    "/notifications/read-all",
    { preHandler: [app.authenticate] },
    async (_req, reply) => {
      await pool.query("UPDATE notifications SET read = true WHERE read = false");
      return reply.send({ ok: true });
    },
  );

  // Delete all notifications
  app.delete(
    "/notifications",
    { preHandler: [app.authenticate] },
    async (_req, reply) => {
      await pool.query("DELETE FROM notifications");
      return reply.send({ ok: true });
    },
  );
}
