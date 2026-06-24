/*
 * Costing feature write-logic — expense lines (per-kg & allocated).
 */

import { api } from "@/core/api";
import type { ExpenseBasis } from "@/shared/types";

export interface ExpenseInput {
  batch_id: string;
  category: string;
  amount_ugx: number;
  basis: ExpenseBasis;
  allocation_group_id: string | null;
  note?: string;
}

/** Add an expense line via the live API (allocation_group_id is sent as a label). */
export function useAddExpenseApi() {
  return (input: ExpenseInput) =>
    api.addExpense({
      batch_id: input.batch_id,
      category: input.category,
      amount_ugx: input.amount_ugx,
      basis: input.basis,
      allocation_group_label: input.allocation_group_id,
      note: input.note,
    });
}

export function useDeleteExpenseApi() {
  return (id: string) => api.deleteExpense(id);
}
