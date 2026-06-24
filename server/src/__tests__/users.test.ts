import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db.ts", () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  withTx: vi.fn(),
}));

vi.mock("../repos/users.ts", () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
}));

import { buildApp } from "../app.ts";
import { createUser, updateUser, deactivateUser } from "../repos/users.ts";

const USER_UUID = "00000000-0000-0000-0000-0000000000aa";

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

const validCreate = {
  name: "Jane Doe",
  email: "jane@ceos.ug",
  role: "accountant",
  temp_password: "supersecret",
};

describe("POST /users", () => {
  it("returns 401 with no token", async () => {
    const res = await app.inject({ method: "POST", url: "/users", body: validCreate });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for grader (lacks users.manage)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: `Bearer ${graderToken}` },
      body: validCreate,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().needs).toBe("users.manage");
  });

  it("returns 400 for invalid email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { ...validCreate, email: "not-an-email" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });

  it("returns 400 for short temp_password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { ...validCreate, temp_password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 201 + created user for admin", async () => {
    vi.mocked(createUser).mockResolvedValueOnce({
      id: USER_UUID,
      name: validCreate.name,
      email: validCreate.email,
      phone: null,
      role: validCreate.role,
      active: true,
    });

    const res = await app.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: `Bearer ${adminToken}` },
      body: validCreate,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(USER_UUID);
    expect(vi.mocked(createUser)).toHaveBeenCalledWith({ ...validCreate, actor: "u-admin" });
  });

  it("surfaces 409 from repo (email_taken)", async () => {
    vi.mocked(createUser).mockRejectedValueOnce(
      Object.assign(new Error("email_taken"), { statusCode: 409, code: "email_taken" }),
    );
    const res = await app.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: `Bearer ${adminToken}` },
      body: validCreate,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("email_taken");
  });
});

describe("PUT /users/:id", () => {
  it("returns 400 when neither name nor role provided", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/users/${USER_UUID}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });

  it("returns 200 + updated user for admin", async () => {
    vi.mocked(updateUser).mockResolvedValueOnce({
      id: USER_UUID,
      name: "New Name",
      email: "jane@ceos.ug",
      role: "admin",
      active: true,
    });
    const res = await app.inject({
      method: "PUT",
      url: `/users/${USER_UUID}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { role: "admin" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("admin");
    expect(vi.mocked(updateUser)).toHaveBeenCalledWith({ id: USER_UUID, role: "admin", actor: "u-admin" });
  });

  it("surfaces 404 from repo (user_not_found)", async () => {
    vi.mocked(updateUser).mockRejectedValueOnce(
      Object.assign(new Error("user_not_found"), { statusCode: 404, code: "user_not_found" }),
    );
    const res = await app.inject({
      method: "PUT",
      url: `/users/${USER_UUID}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { name: "Whoever" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /users/:id", () => {
  it("returns 403 for grader", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/users/${USER_UUID}`,
      headers: { authorization: `Bearer ${graderToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 on success", async () => {
    vi.mocked(deactivateUser).mockResolvedValueOnce({ ok: true });
    const res = await app.inject({
      method: "DELETE",
      url: `/users/${USER_UUID}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(vi.mocked(deactivateUser)).toHaveBeenCalledWith(USER_UUID, "u-admin");
  });

  it("surfaces 400 from repo (cannot_deactivate_self)", async () => {
    vi.mocked(deactivateUser).mockRejectedValueOnce(
      Object.assign(new Error("cannot_deactivate_self"), {
        statusCode: 400,
        code: "cannot_deactivate_self",
      }),
    );
    const res = await app.inject({
      method: "DELETE",
      url: `/users/${USER_UUID}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("cannot_deactivate_self");
  });
});
