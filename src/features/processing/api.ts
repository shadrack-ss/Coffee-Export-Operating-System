/*
 * Processing feature write-logic — records a change of form, creates the child
 * batch (parent_batch_id linked) and advances the parent.
 */

import { api } from "@/core/api";
import type { ProcessType } from "@/shared/types";

export interface ProcessingInput {
  input_batch_id: string;
  input_kg: number;
  output_kg: number;
  process_type: ProcessType;
}

/** Record processing via the live API; returns the created child batch id. */
export function useRecordProcessingApi() {
  return (input: ProcessingInput) => api.recordProcessing(input);
}
