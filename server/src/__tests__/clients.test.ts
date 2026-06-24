import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db.ts", () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  withTx: vi.fn(),
}));

vi.mock("../repos/clients.ts", () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
}));

import { buildApp } from "../app.ts";
import { createClient, updateClient } from "../repos/clients.ts";

const CLIENT_UUID = "00000000-0000-0000-0000-0000000000bb";

let app: FastifyInstance;
let adminToken: string;
let auditorToken: string;

beforeAll(async () => {
  app = await buildApp({ logger: false, skipRateLimit: true });
  await app.ready();
  adminToken = app.jwt.sign({ sub: "u-admin", role: "admin", name: "Admin" });
  auditorToken = app.jwt.sign({ sub: "u-auditor", role: "auditor", name: "Auditor" });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const validClient = {
  name: "Hamburg Coffee GmbH",
  country: "Germany",
  email: "buyer@hamburg.de",
  segment: "Specialty",
};

describe("POST /clients", () => {
  it("returns 401 with no token", async () => {
    const res = await app.inject({ method: "POST", url: "/clients", body: validClient });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for auditor (lacks clients.manage)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/clients",
      headers: { authorization: `Bearer ${auditorToken}` },
      body: validClient,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().needs).toBe("clients.manage");
  });

  it("returns 400 for invalid body (bad email)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/clients",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { ...validClient, email: "nope" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });

  it("returns 201 + created client for admin", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({ id: CLIENT_UUID, ...validClient });
    const res = await app.inject({
      method: "POST",
      url: "/clients",
      headers: { authorization: `Bearer ${adminToken}` },
      body: validClient,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(CLIENT_UUID);
    expect(vi.mocked(createClient)).toHaveBeenCalledWith({ ...validClient, actor: "u-admin" });
  });
});

describe("PUT /clients/:id", () => {
  it("returns 200 + updated client (partial body)", async () => {
    vi.mocked(updateClient).mockResolvedValueOnce({ id: CLIENT_UUID, ...validClient, segment: "Commercial" });
    const res = await app.inject({
      method: "PUT",
      url: `/clients/${CLIENT_UUID}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { segment: "Commercial" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().segment).toBe("Commercial");
    expect(vi.mocked(updateClient)).toHaveBeenCalledWith({
      id: CLIENT_UUID,
      segment: "Commercial",
      actor: "u-admin",
    });
  });

  it("surfaces 404 from repo (client_not_found)", async () => {
    vi.mocked(updateClient).mockRejectedValueOnce(
      Object.assign(new Error("client_not_found"), { statusCode: 404, code: "client_not_found" }),
    );
    const res = await app.inject({
      method: "PUT",
      url: `/clients/${CLIENT_UUID}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { name: "Renamed Buyer" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("client_not_found");
  });
});
