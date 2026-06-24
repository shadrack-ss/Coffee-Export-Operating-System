import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

// Mock the DB module before any app imports — prevents pool connecting on import.
vi.mock("../db.ts", () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  withTx: vi.fn(),
}));

import { buildApp } from "../app.ts";
import { hashPassword } from "../auth/password.ts";
import { pool } from "../db.ts";

let app: FastifyInstance;

// Pre-compute a real scrypt hash once (proves the full auth flow).
const TEST_PW = "correct-horse-battery";
const TEST_HASH = hashPassword(TEST_PW);

beforeAll(async () => {
  app = await buildApp({ logger: false, skipRateLimit: true });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("POST /auth/login", () => {
  it("returns 400 for malformed body (missing password)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      body: { email: "admin@ceos.ug" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });

  it("returns 400 for invalid email format", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      body: { email: "not-an-email", password: "pw" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 when user does not exist", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      body: { email: "nobody@ceos.ug", password: "pw" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("invalid_credentials");
  });

  it("returns 401 when user is inactive", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: "u1",
          name: "Gone",
          email: "inactive@ceos.ug",
          role: "grader",
          password_hash: TEST_HASH,
          active: false,
        },
      ],
    } as never);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      body: { email: "inactive@ceos.ug", password: TEST_PW },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for wrong password", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: "u1",
          name: "Admin",
          email: "admin@ceos.ug",
          role: "admin",
          password_hash: TEST_HASH,
          active: true,
        },
      ],
    } as never);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      body: { email: "admin@ceos.ug", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("invalid_credentials");
  });

  it("returns 200 + JWT + user on valid credentials", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: "u1",
          name: "Test Admin",
          email: "admin@ceos.ug",
          role: "admin",
          password_hash: TEST_HASH,
          active: true,
        },
      ],
    } as never);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      body: { email: "admin@ceos.ug", password: TEST_PW },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ token: string; user: { role: string } }>();
    expect(typeof body.token).toBe("string");
    expect(body.token.split(".")).toHaveLength(3); // valid JWT structure
    expect(body.user.role).toBe("admin");
  });
});

describe("GET /auth/me", () => {
  it("returns 401 without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("returns the decoded user on a valid token", async () => {
    const token = app.jwt.sign({ sub: "u1", role: "admin", name: "Test Admin" });

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ sub: string; role: string }>();
    expect(body.sub).toBe("u1");
    expect(body.role).toBe("admin");
  });
});
