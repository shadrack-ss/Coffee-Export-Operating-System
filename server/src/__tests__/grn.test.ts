import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db.ts", () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  withTx: vi.fn(),
}));

vi.mock("../repos/settings.ts", () => ({
  loadSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("../repos/batches.ts", () => ({
  nextBatchCode: vi.fn(),
  getBatch: vi.fn(),
  listBatches: vi.fn(),
}));

import { buildApp } from "../app.ts";
import { withTx } from "../db.ts";
import { loadSettings } from "../repos/settings.ts";

const stubSettings = {
  mc_standard_pct: 14,
  fm_standard_pct: 0.5,
  defect_standard_pct: 5,
  default_defect_handling: "weight",
  fm_base: "net_physical",
  ura_tax_pct: 2,
  handling_per_kg: 100,
  gunny_bags_per_kg: 109,
  gunny_bags_usd_ref_rate: 3600,
  paperwork_per_kg: 50,
  target_margin_pct: 10,
  coffee_grades: ["Screen 18 (AA)", "FAQ"],
  districts: ["Kampala"],
  expense_categories: [],
};

const validGrnBody = {
  supplier_id: "00000000-0000-0000-0000-000000000001",
  district_id: 1,
  grade_id: 2,
  buyer_id: null,
  market_price_per_kg: 7400,
  gross_weight_kg: 1000,
  tare_weight_kg: 0,
  moisture_pct: 14,
  fallen_matter_pct: 0,
  defect_breakdown: {
    black_beans_pct: 0,
    broken_pct: 0,
    husks_pct: 0,
    insect_damage_pct: 0,
    foreign_matter_pct: 0,
  },
  defect_handling_mode: "weight",
};

let app: FastifyInstance;
let adminToken: string;
let auditorToken: string;

beforeAll(async () => {
  app = await buildApp({ logger: false, skipRateLimit: true });
  await app.ready();
  adminToken = app.jwt.sign({ sub: "u-admin", role: "admin", name: "Admin" });
  auditorToken = app.jwt.sign({ sub: "u-audit", role: "auditor", name: "Auditor" });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /grn", () => {
  it("returns 401 with no token", async () => {
    const res = await app.inject({ method: "POST", url: "/grn", body: validGrnBody });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for auditor (lacks grn.create)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/grn",
      headers: { authorization: `Bearer ${auditorToken}` },
      body: validGrnBody,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().needs).toBe("grn.create");
  });

  it("returns 400 for missing required field (supplier_id)", async () => {
    const { supplier_id: _omit, ...badBody } = validGrnBody;
    const res = await app.inject({
      method: "POST",
      url: "/grn",
      headers: { authorization: `Bearer ${adminToken}` },
      body: badBody,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });

  it("returns 400 for invalid defect_handling_mode", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/grn",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { ...validGrnBody, defect_handling_mode: "unknown_mode" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 201 with batch code and derivation steps on happy path", async () => {
    vi.mocked(loadSettings).mockResolvedValueOnce(stubSettings as never);
    vi.mocked(withTx).mockResolvedValueOnce({
      batch: {
        id: "batch-uuid-1",
        batch_code: "KMP-2026-0001",
        net_payable_weight_kg: 1000,
      },
      derivation: [
        { label: "Net physical", key: "net_physical", rule: "gross - tare", weight_kg: 1000, delta_kg: 0 },
      ],
      recommended_grade: "FAQ",
    });

    const res = await app.inject({
      method: "POST",
      url: "/grn",
      headers: { authorization: `Bearer ${adminToken}` },
      body: validGrnBody,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ batch: { batch_code: string }; recommended_grade: string }>();
    expect(body.batch.batch_code).toBe("KMP-2026-0001");
    expect(body.recommended_grade).toBe("FAQ");
    expect(vi.mocked(loadSettings)).toHaveBeenCalledOnce();
    expect(vi.mocked(withTx)).toHaveBeenCalledOnce();
  });

  it("returns 400 for negative gross weight", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/grn",
      headers: { authorization: `Bearer ${adminToken}` },
      body: { ...validGrnBody, gross_weight_kg: -1 },
    });
    expect(res.statusCode).toBe(400);
  });
});
