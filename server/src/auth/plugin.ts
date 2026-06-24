/*
 * Auth plugin: JWT verification + role-based access control.
 *
 * RBAC is enforced HERE (the server is the source of truth), using the SAME
 * permission matrix the frontend uses (shared/authz). UI gating is convenience;
 * this is the real gate.
 */

import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.ts";
import { can, type Permission } from "../domain.ts";
import type { Role } from "../domain.ts";

export interface AuthUser {
  sub: string; // user id
  role: Role;
  name: string;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      perm: Permission,
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

export default fp(async (app) => {
  await app.register(jwt, { secret: config.jwtSecret });

  // DEFAULT-DENY: every request must carry a valid JWT unless the route opts out
  // with `config: { public: true }`. A forgotten guard can never leak an endpoint
  // — new routes are authenticated by default.
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const isPublic = (req.routeOptions?.config as { public?: boolean })?.public;
    if (isPublic) return;
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthenticated" });
    }
  });

  // Explicit auth preHandler (rarely needed now that auth is global, kept for
  // routes that want to be self-documenting).
  app.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.user) await reply.code(401).send({ error: "unauthenticated" });
    },
  );

  // RBAC: auth already enforced by the global hook; this only checks permission.
  app.decorate("requirePermission", (perm: Permission) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.user) {
        return reply.code(401).send({ error: "unauthenticated" });
      }
      if (!can(req.user.role, perm)) {
        return reply
          .code(403)
          .send({ error: "forbidden", needs: perm, role: req.user.role });
      }
    };
  });
});
