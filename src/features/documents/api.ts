/*
 * Documents feature write-logic — records a generated document.
 */

import { useData } from "@/core/store";
import type { DocumentRecord } from "@/shared/types";

export interface GenerateDocumentInput {
  type: string;
  batch_id: string | null;
  shipment_id: string | null;
}

export function useGenerateDocument() {
  const store = useData();
  return (input: GenerateDocumentInput, actor: string): string => {
    const ts = new Date().toISOString();
    const id = `doc-${Date.now()}`;
    const ref = input.batch_id ?? input.shipment_id ?? "";
    const doc: DocumentRecord = {
      id,
      batch_id: input.batch_id,
      shipment_id: input.shipment_id,
      type: input.type,
      // frontend-first: the printable view is the artifact; real PDFs land in
      // Supabase Storage with the backend.
      file_url: `print://${input.type}/${ref}`,
      generated_at: ts,
      created_at: ts,
      created_by: actor,
    };
    store.update({ documents: [...store.documents, doc] });
    return id;
  };
}
