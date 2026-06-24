/** Document types CE-OS generates (§5.8). */
export type DocScope = "batch" | "shipment";

export interface DocType {
  key: string;
  label: string;
  scope: DocScope;
  /** which content blocks to render in the printable */
  blocks: Array<"quality" | "costing" | "amount" | "contributors" | "shipping">;
}

export const DOC_TYPES: DocType[] = [
  { key: "grn", label: "Goods Received Note", scope: "batch", blocks: ["quality", "amount"] },
  { key: "receipt", label: "Receipt", scope: "batch", blocks: ["amount"] },
  { key: "quality_cert", label: "Quality Certificate", scope: "batch", blocks: ["quality"] },
  { key: "invoice", label: "Invoice", scope: "batch", blocks: ["costing", "amount"] },
  { key: "proforma", label: "Proforma Invoice", scope: "batch", blocks: ["costing", "amount"] },
  { key: "commercial_invoice", label: "Commercial Invoice", scope: "shipment", blocks: ["contributors", "shipping"] },
  { key: "packing_list", label: "Packing List", scope: "shipment", blocks: ["contributors", "shipping"] },
  { key: "certificate_origin", label: "Certificate of Origin", scope: "shipment", blocks: ["contributors", "shipping"] },
  { key: "phytosanitary", label: "Phytosanitary Certificate", scope: "shipment", blocks: ["shipping"] },
  { key: "delivery_note", label: "Delivery Note", scope: "shipment", blocks: ["contributors", "shipping"] },
];

export function docTypeByKey(key: string): DocType | undefined {
  return DOC_TYPES.find((d) => d.key === key);
}
