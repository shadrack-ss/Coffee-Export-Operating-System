import type { FastifyInstance } from "fastify";
import { listSuppliers, listDistricts, listGrades } from "../repos/reference.ts";

export default async function referenceRoutes(app: FastifyInstance) {
  // Everything the New GRN form needs to populate its dropdowns, in one call.
  // Authenticated (default-deny); any signed-in role may read reference data.
  app.get("/reference", async () => {
    const [suppliers, districts, grades] = await Promise.all([
      listSuppliers(),
      listDistricts(),
      listGrades(),
    ]);
    return { suppliers, districts, grades };
  });
}
