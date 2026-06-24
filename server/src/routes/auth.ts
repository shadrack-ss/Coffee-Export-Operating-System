import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.ts";
import { verifyPassword } from "../auth/password.ts";
import { changeOwnPassword } from "../repos/users.ts";
import type { Role } from "../domain.ts";

const loginBody = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordBody = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  password_hash: string | null;
  active: boolean;
}

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/login",
    {
      config: {
        public: true,
        rateLimit: { max: 5, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const parsed = loginBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body" });
      }
      const { identifier, password } = parsed.data;

      // Match by email (case-insensitive) OR phone (exact)
      const { rows } = await pool.query<UserRow>(
        `SELECT id, name, email, phone, role, password_hash, active
           FROM users
          WHERE lower(email) = lower($1) OR phone = $1`,
        [identifier],
      );
      const user = rows[0];
      if (!user || !user.active || !user.password_hash) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      if (!verifyPassword(password, user.password_hash)) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }

      const token = app.jwt.sign(
        { sub: user.id, role: user.role, name: user.name },
        { expiresIn: "12h" },
      );
      return {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      };
    },
  );

  app.get(
    "/auth/me",
    { preHandler: [app.authenticate] },
    async (req) => req.user,
  );

  app.post(
    "/auth/change-password",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = changePasswordBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
      try {
        await changeOwnPassword(
          req.user.sub,
          parsed.data.current_password,
          parsed.data.new_password,
        );
        return reply.send({ ok: true });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        const status = e.statusCode ?? 500;
        if (status >= 500) throw err as Error;
        return reply.code(status).send({ error: e.message ?? "error" });
      }
    },
  );
}
