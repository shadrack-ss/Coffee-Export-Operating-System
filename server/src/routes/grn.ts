/*
 * POST /grn — the GRN write slice. Proves the architecture end-to-end:
 *   - RBAC (requires grn.create)
 *   - reuses the SHARED pure calc (computeQuality, recommendGrade) server-side
 *   - one transaction writes batch + quality + audit + alerts (authoritative)
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTx } from "../db.ts";
import { loadSettings } from "../repos/settings.ts";
import { nextBatchCode } from "../repos/batches.ts";
import { computeQuality, recommendGrade } from "../domain.ts";

const grnBody = z.object({
  supplier_id: z.string().uuid(),
  district_id: z.number().int(),
  grade_id: z.number().int(),
  buyer_id: z.string().uuid().nullable().default(null),
  market_price_per_kg: z.number().int().nonnegative(),
  gross_weight_kg: z.number().nonnegative(),
  tare_weight_kg: z.number().nonnegative(),
  moisture_pct: z.number().min(0).max(100),
  fallen_matter_pct: z.number().min(0),
  defect_breakdown: z.object({
    black_beans_pct: z.number().min(0),
    broken_pct: z.number().min(0),
    husks_pct: z.number().min(0),
    insect_damage_pct: z.number().min(0),
    foreign_matter_pct: z.number().min(0),
  }),
  defect_handling_mode: z.enum(["weight", "discount"]),
});

export default async function grnRoutes(app: FastifyInstance) {
  app.post(
    "/grn",
    { preHandler: [app.requirePermission("grn.create")] },
    async (req, reply) => {
      const parsed = grnBody.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "invalid_body", details: parsed.error.flatten() });
      }
      const b = parsed.data;
      const actor = req.user.sub;
      const settings = await loadSettings();

      const defect_pct =
        Math.round(
          (b.defect_breakdown.black_beans_pct +
            b.defect_breakdown.broken_pct +
            b.defect_breakdown.husks_pct +
            b.defect_breakdown.insect_damage_pct +
            b.defect_breakdown.foreign_matter_pct) *
            100,
        ) / 100;

      // Same pure function the UI uses — server is the source of truth.
      const q = computeQuality(
        {
          gross_weight_kg: b.gross_weight_kg,
          tare_weight_kg: b.tare_weight_kg,
          moisture_pct: b.moisture_pct,
          fallen_matter_pct: b.fallen_matter_pct,
          defect_pct,
          defect_handling_mode: b.defect_handling_mode,
          market_price_per_kg: b.market_price_per_kg,
        },
        settings,
      );
      const recommendedName = recommendGrade(b.moisture_pct, defect_pct);

      const result = await withTx(async (c) => {
        const gradeRes = await c.query<{ id: number }>(
          `SELECT id FROM coffee_grades WHERE name = $1`,
          [recommendedName],
        );
        const recommendedGradeId = gradeRes.rows[0]?.id;
        if (!recommendedGradeId) {
          throw new Error(`recommended grade '${recommendedName}' not seeded`);
        }

        const batch_code = await nextBatchCode(c, b.district_id);
        const ts = new Date().toISOString();

        const batchRes = await c.query(
          `INSERT INTO batches
             (batch_code, supplier_id, district_id, grade_id, status,
              gross_weight_kg, tare_weight_kg, net_payable_weight_kg,
              buyer_id, market_price_per_kg, created_by)
           VALUES ($1,$2,$3,$4,'graded',$5,$6,$7,$8,$9,$10)
           RETURNING *`,
          [
            batch_code,
            b.supplier_id,
            b.district_id,
            b.grade_id,
            b.gross_weight_kg,
            b.tare_weight_kg,
            q.net_payable_weight_kg,
            b.buyer_id,
            b.market_price_per_kg,
            actor,
          ],
        );
        const batch = batchRes.rows[0];

        await c.query(
          `INSERT INTO quality_metrics
             (batch_id, moisture_pct, fallen_matter_pct, defect_pct,
              black_beans_pct, broken_pct, husks_pct, insect_damage_pct,
              foreign_matter_pct, defect_handling_mode, recommended_grade_id,
              graded_by, graded_at, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$12)`,
          [
            batch.id,
            b.moisture_pct,
            b.fallen_matter_pct,
            defect_pct,
            b.defect_breakdown.black_beans_pct,
            b.defect_breakdown.broken_pct,
            b.defect_breakdown.husks_pct,
            b.defect_breakdown.insect_damage_pct,
            b.defect_breakdown.foreign_matter_pct,
            b.defect_handling_mode,
            recommendedGradeId,
            actor,
            ts,
          ],
        );

        await c.query(
          `INSERT INTO audit_log (actor, action, entity_type, entity_id, new_value, at)
           VALUES ($1, 'create_grn', 'batch', $2, $3, $4)`,
          [actor, batch.id, batch_code, ts],
        );

        // High-moisture / high-defect alerts (§5.7)
        if (b.moisture_pct > settings.mc_standard_pct) {
          const critical = b.moisture_pct >= settings.mc_standard_pct + 5;
          await c.query(
            `INSERT INTO notifications (type, severity, message, target_role, entity_type, entity_id, created_by)
             VALUES ('high_moisture', $1, $2, 'grader', 'batch', $3, $4)`,
            [
              critical ? "critical" : "watch",
              `${batch_code} graded at ${b.moisture_pct}% moisture — ${q.mc_deduction_pct}% weight deduction applied.`,
              batch.id,
              actor,
            ],
          );
        }
        if (defect_pct > settings.defect_standard_pct) {
          const critical = defect_pct >= settings.defect_standard_pct + 5;
          await c.query(
            `INSERT INTO notifications (type, severity, message, target_role, entity_type, entity_id, created_by)
             VALUES ('high_defects', $1, $2, 'grader', 'batch', $3, $4)`,
            [
              critical ? "critical" : "watch",
              `${batch_code} defects at ${defect_pct}% — ${q.defect_excess_pct}% over the ${settings.defect_standard_pct}% standard.`,
              batch.id,
              actor,
            ],
          );
        }

        return { batch, derivation: q.steps, recommended_grade: recommendedName };
      });

      return reply.code(201).send(result);
    },
  );
}
