import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../db.ts", () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  withTx: vi.fn(),
}));

vi.mock("../services/pdf.ts", () => ({
  htmlToPdf: vi.fn(),
}));

vi.mock("../services/docData.ts", () => ({
  loadBatchDocData: vi.fn(),
  loadShipmentDocData: vi.fn(),
}));

vi.mock("../services/docHtml.ts", () => ({
  batchDocHtml: vi.fn(() => "<html>batch</html>"),
  shipmentDocHtml: vi.fn(() => "<html>shipment</html>"),
}));

import { buildApp } from "../app.ts";
import { htmlToPdf } from "../services/pdf.ts";
import { loadBatchDocData, loadShipmentDocData } from "../services/docData.ts";

const BATCH_UUID = "00000000-0000-0000-0000-0000000000d1";
const SHIPMENT_UUID = "00000000-0000-0000-0000-0000000000d2";
const FAKE_PDF = Buffer.from("%PDF-1.4 fake");

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  app = await buildApp({ logger: false, skipRateLimit: true });
  await app.ready();
  // Any authenticated role can fetch documents (no permission gate on the route).
  token = app.jwt.sign({ sub: "u-auditor", role: "auditor", name: "Auditor" });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(htmlToPdf).mockResolvedValue(FAKE_PDF);
});

describe("GET /documents/:type/:id/pdf", () => {
  it("returns 401 with no token", async () => {
    const res = await app.inject({ method: "GET", url: `/documents/grn/${BATCH_UUID}/pdf` });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for an unknown document type", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/documents/not_a_real_type/${BATCH_UUID}/pdf`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("unknown_doc_type");
  });

  it("returns a PDF for a batch document type (grn)", async () => {
    vi.mocked(loadBatchDocData).mockResolvedValueOnce({ batch: { batch_code: "MBL-1" } } as never);

    const res = await app.inject({
      method: "GET",
      url: `/documents/grn/${BATCH_UUID}/pdf`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.rawPayload.equals(FAKE_PDF)).toBe(true);
    expect(vi.mocked(loadBatchDocData)).toHaveBeenCalledWith(BATCH_UUID);
  });

  it("returns 404 when the batch is not found", async () => {
    vi.mocked(loadBatchDocData).mockResolvedValueOnce(null);
    const res = await app.inject({
      method: "GET",
      url: `/documents/invoice/${BATCH_UUID}/pdf`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("batch_not_found");
  });

  it("returns a PDF for a shipment document type (commercial_invoice)", async () => {
    vi.mocked(loadShipmentDocData).mockResolvedValueOnce({ shipment: { container_no: "MSCU1" } } as never);

    const res = await app.inject({
      method: "GET",
      url: `/documents/commercial_invoice/${SHIPMENT_UUID}/pdf`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(vi.mocked(loadShipmentDocData)).toHaveBeenCalledWith(SHIPMENT_UUID);
  });

  it("returns 404 when the shipment is not found", async () => {
    vi.mocked(loadShipmentDocData).mockResolvedValueOnce(null);
    const res = await app.inject({
      method: "GET",
      url: `/documents/packing_list/${SHIPMENT_UUID}/pdf`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("shipment_not_found");
  });
});
