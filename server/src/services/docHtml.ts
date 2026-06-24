import type { BatchDocData, ShipmentDocData } from "./docData.ts";

// ── Formatters ───────────────────────────────────────────────────────────────

const ugx = (n: number) => n.toLocaleString("en-UG");
const ugxLabel = (n: number) => `UGX ${ugx(Math.round(n))}`;
const kg = (n: number) => n.toLocaleString("en-UG", { maximumFractionDigits: 3 });
const pct = (n: number) => `${n.toFixed(2)} %`;
const usd = (n: number) => `$${n.toFixed(4)}`;
const rate = (n: number) => n.toLocaleString("en-UG");

const DOC_LABELS: Record<string, string> = {
  grn: "Goods Received Note",
  receipt: "Receipt",
  quality_cert: "Quality Certificate",
  invoice: "Invoice",
  proforma: "Proforma Invoice",
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  certificate_origin: "Certificate of Origin",
  phytosanitary: "Phytosanitary Certificate",
  delivery_note: "Delivery Note",
};

const DOC_BLOCKS: Record<string, string[]> = {
  grn: ["quality", "amount"],
  receipt: ["amount"],
  quality_cert: ["quality"],
  invoice: ["costing", "amount"],
  proforma: ["costing", "amount"],
  commercial_invoice: ["contributors", "shipping"],
  packing_list: ["contributors", "shipping"],
  certificate_origin: ["contributors", "shipping"],
  phytosanitary: ["shipping"],
  delivery_note: ["contributors", "shipping"],
};

// ── Base page shell ──────────────────────────────────────────────────────────

function page(docType: string, docNo: string, innerHtml: string): string {
  const label = DOC_LABELS[docType] ?? docType;
  const dateStr = new Date().toLocaleDateString("en-UG", {
    year: "numeric", month: "long", day: "numeric",
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: white; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: #1c1917;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { max-width: 794px; margin: 0 auto; padding: 48px 52px; }

  /* header */
  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #292524; padding-bottom: 16px; margin-bottom: 4px;
  }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo-mark {
    width: 44px; height: 44px; background: #b45309; border-radius: 6px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .logo-mark svg { width: 24px; height: 24px; stroke: white; stroke-width: 2;
    fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .co-name { font-size: 18px; font-weight: 700; line-height: 1.1; }
  .co-sub { font-size: 11px; color: #78716c; margin-top: 2px; }
  .doc-title { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; text-align: right; }
  .doc-meta { font-size: 11px; color: #78716c; text-align: right; margin-top: 3px; line-height: 1.5; }

  /* parties */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 18px 0; }
  .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.6px; color: #a8a29e; margin-bottom: 5px; }
  .party-name { font-weight: 600; font-size: 14px; }
  .party-line { font-size: 12px; color: #57534e; margin-top: 1px; }

  /* sections */
  .section { border-top: 1px solid #e7e5e4; padding: 14px 0; }
  .section-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.6px; color: #78716c; margin-bottom: 10px;
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    font-size: 11px; font-weight: 600; color: #78716c;
    text-align: left; padding: 4px 0; border-bottom: 1px solid #d6d3d1;
  }
  td { padding: 5px 0; font-size: 12.5px; }
  .td-right { text-align: right; }
  .tr-total td { border-top: 1px solid #d6d3d1; font-weight: 700; padding-top: 7px; }
  .tr-sub td { color: #78716c; padding-left: 14px; }
  .tab { font-variant-numeric: tabular-nums; }

  /* signatures */
  .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 52px; }
  .sig { flex: 1; }
  .sig-line { border-top: 1px solid #a8a29e; margin-top: 36px; }
  .sig-label { font-size: 11px; color: #78716c; margin-top: 4px; }

  /* footer */
  .footer { text-align: center; font-size: 10px; color: #a8a29e; margin-top: 36px; }
</style>
</head>
<body>
<div class="sheet">

  <div class="header">
    <div class="logo">
      <div class="logo-mark">
        <svg viewBox="0 0 24 24">
          <path d="M10 2v2M14 2v2M6 2v2"/>
          <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>
        </svg>
      </div>
      <div>
        <div class="co-name">CE-OS Coffee Exporters</div>
        <div class="co-sub">Kampala, Uganda &middot; UCDA Lic. UG-EXP-0042</div>
      </div>
    </div>
    <div>
      <div class="doc-title">${label}</div>
      <div class="doc-meta">No. ${docNo}<br>${dateStr}</div>
    </div>
  </div>

  ${innerHtml}

  <div class="signatures">
    <div class="sig"><div class="sig-line"></div><div class="sig-label">Authorised by</div></div>
    <div class="sig"><div class="sig-line"></div><div class="sig-label">Received by</div></div>
  </div>

  <div class="footer">Generated by CE-OS &middot; This document reflects records at time of printing.</div>
</div>
</body>
</html>`;
}

// ── Batch document ───────────────────────────────────────────────────────────

export function batchDocHtml(docType: string, data: BatchDocData): string {
  const { batch, supplier, buyer, quality, financials } = data;
  const blocks = DOC_BLOCKS[docType] ?? [];
  const docNo = `${docType.toUpperCase().replace(/_/g, "-")}-${batch.id.slice(-6).toUpperCase()}`;
  const isInvoice = docType === "invoice" || docType === "proforma";

  const partiesHtml = `
  <div class="parties">
    <div>
      <div class="party-label">Batch</div>
      <div class="party-name">${batch.batch_code}</div>
      <div class="party-line">${batch.coffee_grade}</div>
      <div class="party-line" style="color:#78716c">${batch.origin_district}</div>
    </div>
    <div>
      <div class="party-label">Supplier</div>
      <div class="party-name">${supplier?.name ?? "—"}</div>
      <div class="party-line">${supplier?.type?.replace(/_/g, " ") ?? ""}</div>
      <div class="party-line" style="color:#78716c">${supplier?.contact ?? ""}</div>
    </div>
  </div>`;

  let blocksHtml = "";

  // Quality block
  if (blocks.includes("quality") && quality) {
    blocksHtml += `
  <div class="section">
    <div class="section-title">Quality Assessment</div>
    <table>
      <tbody>
        <tr><td>Moisture</td><td class="td-right tab">${pct(quality.moisture_pct)}</td></tr>
        <tr><td>Fallen matter</td><td class="td-right tab">${pct(quality.fallen_matter_pct)}</td></tr>
        <tr><td>Total defects</td><td class="td-right tab">${pct(quality.defect_pct)}</td></tr>
        <tr class="tr-sub"><td>— black beans</td><td class="td-right tab">${pct(quality.defect_breakdown.black_beans_pct)}</td></tr>
        <tr class="tr-sub"><td>— broken</td><td class="td-right tab">${pct(quality.defect_breakdown.broken_pct)}</td></tr>
        <tr class="tr-sub"><td>— husks</td><td class="td-right tab">${pct(quality.defect_breakdown.husks_pct)}</td></tr>
        <tr class="tr-sub"><td>— insect damage</td><td class="td-right tab">${pct(quality.defect_breakdown.insect_damage_pct)}</td></tr>
        <tr class="tr-sub"><td>— foreign matter</td><td class="td-right tab">${pct(quality.defect_breakdown.foreign_matter_pct)}</td></tr>
        <tr class="tr-total"><td>Recommended grade</td><td class="td-right">${quality.recommended_grade}</td></tr>
      </tbody>
    </table>
  </div>`;
  }

  // Costing block
  if (blocks.includes("costing") && financials.components.length > 0) {
    const rows = financials.components
      .map((c) => `<tr><td>${c.label}</td><td class="td-right tab">${ugx(c.per_kg)} /kg</td></tr>`)
      .join("");
    blocksHtml += `
  <div class="section">
    <div class="section-title">Cost Build-up (UGX/kg)</div>
    <table>
      <tbody>
        ${rows}
        <tr class="tr-total">
          <td>Landed cost / kg</td>
          <td class="td-right tab">${ugx(financials.landed_cost_per_kg)} /kg</td>
        </tr>
      </tbody>
    </table>
  </div>`;
  }

  // Amount block
  if (blocks.includes("amount")) {
    const farmerAmount = Math.round(financials.net_payable_weight_kg * financials.effective_price_per_kg);
    blocksHtml += `
  <div class="section">
    <div class="section-title">Settlement</div>
    <table>
      <tbody>
        <tr><td>Gross weight</td><td class="td-right tab">${kg(batch.gross_weight_kg)} kg</td></tr>
        <tr><td>Tare weight</td><td class="td-right tab">${kg(batch.tare_weight_kg)} kg</td></tr>
        <tr><td>Net payable weight</td><td class="td-right tab">${kg(financials.net_payable_weight_kg)} kg</td></tr>
        <tr><td>Price / kg</td><td class="td-right tab">${ugxLabel(financials.effective_price_per_kg)}</td></tr>
        <tr class="tr-total">
          <td>${isInvoice ? "Total landed cost" : "Amount payable"}</td>
          <td class="td-right tab">${ugxLabel(isInvoice ? financials.total_landed_cost : farmerAmount)}</td>
        </tr>
        ${isInvoice && financials.usd_ugx_rate > 0 ? `
        <tr>
          <td style="color:#78716c">FOB ${usd(financials.selling_price_usd_per_kg)}/kg &middot; rate ${rate(financials.usd_ugx_rate)}</td>
          <td class="td-right tab">${ugxLabel(financials.revenue_ugx)}</td>
        </tr>` : ""}
      </tbody>
    </table>
  </div>`;
  }

  if (buyer && (blocks.includes("amount") || isInvoice)) {
    blocksHtml += `
  <div class="section">
    <div class="section-title">Consignee</div>
    <div class="party-name">${buyer.name}</div>
    <div class="party-line">${buyer.country}</div>
    <div class="party-line" style="color:#78716c">${buyer.email}</div>
  </div>`;
  }

  return page(docType, docNo, partiesHtml + blocksHtml);
}

// ── Shipment document ────────────────────────────────────────────────────────

export function shipmentDocHtml(docType: string, data: ShipmentDocData): string {
  const { shipment, buyer, contributions, total_kg } = data;
  const blocks = DOC_BLOCKS[docType] ?? [];
  const docNo = `${docType.toUpperCase().replace(/_/g, "-")}-${shipment.id.slice(-6).toUpperCase()}`;

  const partiesHtml = `
  <div class="parties">
    <div>
      <div class="party-label">Container</div>
      <div class="party-name">${shipment.container_no}</div>
      <div class="party-line">Seal ${shipment.seal_no}</div>
    </div>
    <div>
      <div class="party-label">Consignee</div>
      <div class="party-name">${buyer?.name ?? "—"}</div>
      <div class="party-line">${buyer?.country ?? shipment.destination_country}</div>
      <div class="party-line" style="color:#78716c">${buyer?.email ?? ""}</div>
    </div>
  </div>`;

  let blocksHtml = "";

  if (blocks.includes("contributors")) {
    const rows = contributions
      .map(
        (c) => `
      <tr>
        <td>${c.batch_code}</td>
        <td>${c.supplier_name}</td>
        <td>${c.origin_district}</td>
        <td class="td-right tab">${kg(Number(c.qty_kg))} kg</td>
      </tr>`,
      )
      .join("");

    blocksHtml += `
  <div class="section">
    <div class="section-title">Contents — contributing batches</div>
    <table>
      <thead>
        <tr>
          <th>Batch</th><th>Farmer / Supplier</th>
          <th>District</th><th class="td-right">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="tr-total">
          <td colspan="3">Total</td>
          <td class="td-right tab">${kg(total_kg)} kg</td>
        </tr>
      </tbody>
    </table>
  </div>`;
  }

  if (blocks.includes("shipping")) {
    blocksHtml += `
  <div class="section">
    <div class="section-title">Shipment details</div>
    <table>
      <tbody>
        <tr><td>Container</td><td class="td-right">${shipment.container_no}</td></tr>
        <tr><td>Seal</td><td class="td-right">${shipment.seal_no}</td></tr>
        <tr><td>Destination</td><td class="td-right">${shipment.destination_country}</td></tr>
        <tr><td>Origin</td><td class="td-right">Uganda</td></tr>
      </tbody>
    </table>
  </div>`;
  }

  return page(docType, docNo, partiesHtml + blocksHtml);
}
