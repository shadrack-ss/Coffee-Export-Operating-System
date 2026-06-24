import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordProcessing } from "../repos/processing.ts";
import { PROCESS_TYPES } from "../domain.ts";

const body = z
  .object({
    input_batch_id: z.string().uuid(),
    input_kg: z.number().positive(),
    output_kg: z.number().positive(),
    process_type: z.enum(PROCESS_TYPES as unknown as [string, ...string[]]),
  })
  .refine((b) => b.output_kg <= b.input_kg, {
    message: "output_kg must be <= input_kg",
    path: ["output_kg"],
  });

export default async function processingRoutes(app: FastifyInstance) {
  app.post(
    "/processing",
    { preHandler: [app.requirePermission("grn.create")] },
    async (req, reply) => {
      const parsed = body.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "invalid_body", details: parsed.error.flatten() });
      }
      const result = await recordProcessing({
        ...parsed.data,
        process_type: parsed.data.process_type as never,
        actor: req.user.sub,
      });
      return reply.code(201).send(result);
    },
  );
}
