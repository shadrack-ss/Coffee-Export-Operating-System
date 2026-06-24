import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db.ts", () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  withTx: vi.fn(),
}));

vi.mock("../repos/approvals.ts", () => ({
  approveBatch: vi.fn(),
}));

import { buildApp } from "../app.ts";
import { approveBatch } from "../repos/approvals.ts";

const BATCH_UUID = "00000000-0000-0000-0000-000000000001";

let app: FastifyInstance;
let adminToken: string;
let graderToken: string;

beforeAll(async () => {
  app = await buildApp({ logger: false, skipRateLimit: true });
  await app.ready();
  adminToken = app.jwt.sign({ sub: "u-admin", role: "admin", name: "Admin" });
  graderToken = app.jwt.sign({ sub: "u-grader", role: "grader", name: "Grader" });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /approvals", () => {
  it("returns 401 with no token", async () => {
    const res = await app.inject({ method: "POST", url: "/approvals", body: { batch_id: BATCH_UUID } });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for grader (lacks payment.approve)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/approvals",
      headers: { authorization: `Bearer ${graderToken}` },
      body: { batch_id: BATCH_UUID },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("forbidden");
    expect(res.json().needs).toBe("payment.approve");
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/approvals",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { batch_id: "not-a-uuid" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });

  it("returns 400 with missing batch_id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/approvals",
      headers: { authorization: `Bearer ${adminToken}` },
      body: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 201 + approval result for admin", async () => {
    vi.mocked(approveBatch).mockResolvedValueOnce({
      batch_id: BATCH_UUID,
      amount_ugx: 88_356_000,
    });

    const res = await app.inject({
      method: "POST",
      url: "/approvals",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { batch_id: BATCH_UUID },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ batch_id: string; amount_ugx: number }>();
    expect(body.batch_id).toBe(BATCH_UUID);
    expect(body.amount_ugx).toBe(88_356_000);
    // Repo was called with the batch id and the actor's sub
    expect(vi.mocked(approveBatch)).toHaveBeenCalledWith(BATCH_UUID, "u-admin");
  });

  it("surfaces 400 from repo (already_approved)", async () => {
    const err = Object.assign(new Error("already_approved"), {
      statusCode: 400,
      code: "already_approved",
    });
    vi.mocked(approveBatch).mockRejectedValueOnce(err);

    const res = await app.inject({
      method: "POST",
      url: "/approvals",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { batch_id: BATCH_UUID },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("already_approved");
  });

  it("surfaces 404 from repo (batch_not_found)", async () => {
    const err = Object.assign(new Error("batch_not_found"), {
      statusCode: 404,
      code: "batch_not_found",
    });
    vi.mocked(approveBatch).mockRejectedValueOnce(err);

    const res = await app.inject({
      method: "POST",
      url: "/approvals",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { batch_id: BATCH_UUID },
    });

    expect(res.statusCode).toBe(404);
  });
});
