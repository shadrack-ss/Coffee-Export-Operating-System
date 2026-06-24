import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db.ts", () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  withTx: vi.fn(),
}));

vi.mock("../repos/shipments.ts", () => ({
  createShipment: vi.fn(),
  allocateBatch: vi.fn(),
}));

import { buildApp } from "../app.ts";
import { createShipment, allocateBatch } from "../repos/shipments.ts";

const SHIPMENT_UUID = "00000000-0000-0000-0000-0000000000c1";
const BUYER_UUID = "00000000-0000-0000-0000-0000000000c2";
const BATCH_UUID = "00000000-0000-0000-0000-0000000000c3";

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

const validShipment = {
  container_no: "MSCU1234567",
  seal_no: "SEAL-001",
  buyer_id: BUYER_UUID,
  destination_country: "Germany",
};

describe("POST /shipments", () => {
  it("returns 401 with no token", async () => {
    const res = await app.inject({ method: "POST", url: "/shipments", body: validShipment });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for grader (lacks payment.approve)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: { authorization: `Bearer ${graderToken}` },
      body: validShipment,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().needs).toBe("payment.approve");
  });

  it("returns 400 for non-UUID buyer_id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { ...validShipment, buyer_id: "not-a-uuid" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });

  it("returns 201 + created shipment for admin", async () => {
    vi.mocked(createShipment).mockResolvedValueOnce({ id: SHIPMENT_UUID, ...validShipment });
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: { authorization: `Bearer ${adminToken}` },
      body: validShipment,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(SHIPMENT_UUID);
    expect(vi.mocked(createShipment)).toHaveBeenCalledWith({ ...validShipment, actor: "u-admin" });
  });

  it("surfaces 400 from repo (buyer_not_found)", async () => {
    vi.mocked(createShipment).mockRejectedValueOnce(
      Object.assign(new Error("buyer_not_found"), { statusCode: 400, code: "buyer_not_found" }),
    );
    const res = await app.inject({
      method: "POST",
      url: "/shipments",
      headers: { authorization: `Bearer ${adminToken}` },
      body: validShipment,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("buyer_not_found");
  });
});

describe("POST /shipments/:id/allocations", () => {
  it("returns 400 for non-positive qty_kg", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/shipments/${SHIPMENT_UUID}/allocations`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { batch_id: BATCH_UUID, qty_kg: 0 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });

  it("returns 201 + allocation for admin", async () => {
    vi.mocked(allocateBatch).mockResolvedValueOnce({
      id: "alloc-1",
      shipment_id: SHIPMENT_UUID,
      batch_id: BATCH_UUID,
      qty_kg: 500,
    });
    const res = await app.inject({
      method: "POST",
      url: `/shipments/${SHIPMENT_UUID}/allocations`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { batch_id: BATCH_UUID, qty_kg: 500 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().qty_kg).toBe(500);
    expect(vi.mocked(allocateBatch)).toHaveBeenCalledWith({
      shipment_id: SHIPMENT_UUID,
      batch_id: BATCH_UUID,
      qty_kg: 500,
      actor: "u-admin",
    });
  });

  it("surfaces 400 from repo (batch_not_approved)", async () => {
    vi.mocked(allocateBatch).mockRejectedValueOnce(
      Object.assign(new Error("batch_not_approved"), { statusCode: 400, code: "batch_not_approved" }),
    );
    const res = await app.inject({
      method: "POST",
      url: `/shipments/${SHIPMENT_UUID}/allocations`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { batch_id: BATCH_UUID, qty_kg: 500 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("batch_not_approved");
  });

  it("surfaces 404 from repo (shipment_not_found)", async () => {
    vi.mocked(allocateBatch).mockRejectedValueOnce(
      Object.assign(new Error("shipment_not_found"), { statusCode: 404, code: "shipment_not_found" }),
    );
    const res = await app.inject({
      method: "POST",
      url: `/shipments/${SHIPMENT_UUID}/allocations`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { batch_id: BATCH_UUID, qty_kg: 500 },
    });
    expect(res.statusCode).toBe(404);
  });
});
