import type { FastifyInstance } from "fastify";
import { htmlToPdf } from "../services/pdf.ts";
import { loadBatchDocData, loadShipmentDocData } from "../services/docData.ts";
import { batchDocHtml, shipmentDocHtml } from "../services/docHtml.ts";

const BATCH_TYPES = new Set([
  "grn", "receipt", "quality_cert", "invoice", "proforma",
]);
const SHIPMENT_TYPES = new Set([
  "commercial_invoice", "packing_list", "certificate_origin",
  "phytosanitary", "delivery_note",
]);

export default async function documentRoutes(app: FastifyInstance) {
  app.get(
    "/documents/:type/:id/pdf",
    async (req, reply) => {
      const { type, id } = req.params as { type: string; id: string };

      let html: string;

      if (BATCH_TYPES.has(type)) {
        const data = await loadBatchDocData(id);
        if (!data) return reply.code(404).send({ error: "batch_not_found" });
        html = batchDocHtml(type, data);
      } else if (SHIPMENT_TYPES.has(type)) {
        const data = await loadShipmentDocData(id);
        if (!data) return reply.code(404).send({ error: "shipment_not_found" });
        html = shipmentDocHtml(type, data);
      } else {
        return reply.code(400).send({ error: "unknown_doc_type" });
      }

      const pdf = await htmlToPdf(html);
      const filename = `${type}-${id.slice(-6).toUpperCase()}.pdf`;

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(pdf);
    },
  );
}
