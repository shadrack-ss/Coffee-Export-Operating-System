import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.ts";
import authPlugin from "./auth/plugin.ts";
import healthRoutes from "./routes/health.ts";
import authRoutes from "./routes/auth.ts";
import batchRoutes from "./routes/batches.ts";
import grnRoutes from "./routes/grn.ts";
import referenceRoutes from "./routes/reference.ts";
import snapshotRoutes from "./routes/snapshot.ts";
import expenseRoutes from "./routes/expenses.ts";
import processingRoutes from "./routes/processing.ts";
import forexRoutes from "./routes/forex.ts";
import settingsRoutes from "./routes/settings.ts";
import approvalRoutes from "./routes/approvals.ts";
import userRoutes from "./routes/users.ts";
import clientRoutes from "./routes/clients.ts";
import supplierRoutes from "./routes/suppliers.ts";
import shipmentRoutes from "./routes/shipments.ts";
import documentRoutes from "./routes/documents.ts";

export interface BuildAppOptions {
  /** Pass `false` to silence the logger in tests. */
  logger?: boolean | object;
  /** Skip rate-limit registration (useful in unit/integration tests). */
  skipRateLimit?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({
    logger: opts.logger !== undefined
      ? opts.logger
      : {
          level: config.isProd ? "info" : "debug",
          // never log credentials/tokens
          redact: ["req.headers.authorization", "req.headers.cookie"],
        },
    bodyLimit: 256 * 1024, // 256 KB — reject oversized payloads (DoS)
    requestTimeout: 15_000, // drop stalled requests
    connectionTimeout: 10_000,
  });

  // security headers
  await app.register(helmet);
  await app.register(cors, { origin: config.corsOrigin, credentials: true });

  // rate limiting — registered BEFORE auth so floods are dropped cheaply,
  // before any DB/crypto work. Per-route overrides (e.g. login) tighten it.
  // Skipped in tests to avoid per-route limits interfering with test suites.
  if (!opts.skipRateLimit) {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute",
      // health checks shouldn't be throttled
      allowList: (req) => req.url === "/health",
    });
  }

  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(batchRoutes);
  await app.register(grnRoutes);
  await app.register(referenceRoutes);
  await app.register(snapshotRoutes);
  await app.register(expenseRoutes);
  await app.register(processingRoutes);
  await app.register(forexRoutes);
  await app.register(settingsRoutes);
  await app.register(approvalRoutes);
  await app.register(userRoutes);
  await app.register(clientRoutes);
  await app.register(supplierRoutes);
  await app.register(shipmentRoutes);
  await app.register(documentRoutes);

  // 404 without leaking which routes exist beyond a generic message
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: "not_found" });
  });

  // central error handler — pass through client errors, hide internals on 500
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      req.log.error(err);
      return reply.code(500).send({ error: "internal_error" });
    }
    // Fastify 5 overwrites err.code with the HTTP reason phrase on plain Errors,
    // so prefer err.message (which carries our domain code like "already_approved").
    return reply.code(status).send({
      error: err.message ?? err.code ?? "error",
    });
  });

  return app;
}
