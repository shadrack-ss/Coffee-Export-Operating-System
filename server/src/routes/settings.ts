import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { updateSettings, loadSettings } from "../repos/settings.ts";

const body = z.object({
  mc_standard_pct: z.number().min(0),
  fm_standard_pct: z.number().min(0),
  defect_standard_pct: z.number().min(0),
  default_defect_handling: z.enum(["weight", "discount"]),
  fm_base: z.enum(["after_mc", "net_physical"]),
  ura_tax_pct: z.number().min(0),
  handling_per_kg: z.number().int().min(0),
  gunny_bags_per_kg: z.number().int().min(0),
  gunny_bags_usd_ref_rate: z.number().int().min(0),
  paperwork_per_kg: z.number().int().min(0),
  target_margin_pct: z.number().min(0),
});

export default async function settingsRoutes(app: FastifyInstance) {
  app.put(
    "/settings",
    { preHandler: [app.requirePermission("settings.edit")] },
    async (req, reply) => {
      const parsed = body.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "invalid_body", details: parsed.error.flatten() });
      }
      await updateSettings(parsed.data);
      return loadSettings();
    },
  );
}
