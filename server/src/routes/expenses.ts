import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { addExpense, deleteExpense } from "../repos/expenses.ts";

const addBody = z.object({
  batch_id: z.string().uuid(),
  category: z.string().min(1),
  amount_ugx: z.number().int().nonnegative(),
  basis: z.enum(["per_kg", "allocated"]),
  allocation_group_label: z.string().nullable().default(null),
  note: z.string().optional(),
});

export default async function expenseRoutes(app: FastifyInstance) {
  app.post(
    "/expenses",
    { preHandler: [app.requirePermission("expense.edit")] },
    async (req, reply) => {
      const parsed = addBody.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "invalid_body", details: parsed.error.flatten() });
      }
      const line = await addExpense({ ...parsed.data, actor: req.user.sub });
      return reply.code(201).send(line);
    },
  );

  app.delete(
    "/expenses/:id",
    { preHandler: [app.requirePermission("expense.edit")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const ok = await deleteExpense(id, req.user.sub);
      if (!ok) return reply.code(404).send({ error: "not_found" });
      return { ok: true };
    },
  );
}
