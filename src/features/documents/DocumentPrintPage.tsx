import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "@/core/store";
import { batchFinancials } from "@/features/batches";
import { containerContributions } from "@/features/traceability";
import { docTypeByKey } from "./docTypes";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/components/states";
import {
  fmtUgx,
  fmtUgxLabel,
  fmtKgLabel,
  fmtKg,
  fmtPct,
  fmtUsd,
  fmtRate,
} from "@/shared/lib/money";
import { ArrowLeft, Printer } from "lucide-react";

export function DocumentPrint() {
  const { type = "", entityId = "" } = useParams();
  const data = useData();
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;
  const docType = docTypeByKey(type);

  const batch =
    docType?.scope === "batch"
      ? data.batches.find((b) => b.id === entityId)
      : undefined;
  const shipment =
    docType?.scope === "shipment"
      ? data.shipments.find((s) => s.id === entityId)
      : undefined;

  const derived = useMemo(
    () => (batch ? batchFinancials(batch, data, liveRate) : null),
    [batch, data, liveRate],
  );
  const contributions = useMemo(
    () => (shipment ? containerContributions(shipment.id, data) : []),
    [shipment, data],
  );

  if (!docType || (!batch && !shipment)) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <EmptyState
          title="Document unavailable"
          description="This document type or its source record could not be found."
          action={
            <Button asChild variant="outline">
              <Link to="/documents">Back to documents</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const supplier = batch
    ? data.suppliers.find((s) => s.id === batch.supplier_id)
    : undefined;
  const buyer = shipment
    ? data.clients.find((c) => c.id === shipment.buyer_id)
    : batch?.buyer_id
      ? data.clients.find((c) => c.id === batch.buyer_id)
      : undefined;
  const quality = batch
    ? data.quality.find((q) => q.batch_id === batch.id)
    : undefined;
  const docNo = `${docType.key.toUpperCase().replace(/_/g, "-")}-${entityId.slice(-6).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-muted/40 py-6">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 no-print">
        <Button asChild variant="ghost">
          <Link to="/documents">
            <ArrowLeft className="size-4" /> Documents
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Print / Save PDF
        </Button>
      </div>

      <div className="print-sheet mx-auto max-w-3xl rounded-lg border border-border bg-white p-10 text-[13px] text-stone-900 shadow-sm">
        {/* header */}
        <div className="flex items-start justify-between border-b-2 border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-[#B45309] text-white">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v2M14 2v2M6 2v2" />
                <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold">CE-OS Coffee Exporters</div>
              <div className="text-xs text-stone-500">
                Kampala, Uganda · UCDA Lic. UG-EXP-0042
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold uppercase tracking-tight">
              {docType.label}
            </div>
            <div className="text-xs text-stone-500">No. {docNo}</div>
            <div className="text-xs text-stone-500">
              {new Date().toLocaleDateString("en-UG", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </div>

        {/* parties / reference */}
        <div className="grid grid-cols-2 gap-6 py-5">
          {batch && (
            <>
              <Block title="Batch">
                <div className="font-semibold">{batch.batch_code}</div>
                <div>{batch.coffee_grade}</div>
                <div className="text-stone-500">{batch.origin_district}</div>
              </Block>
              <Block title="Supplier">
                <div className="font-semibold">{supplier?.name ?? "—"}</div>
                <div className="capitalize text-stone-500">
                  {supplier?.type.replace(/_/g, " ")}
                </div>
                <div className="text-stone-500">{supplier?.contact}</div>
              </Block>
            </>
          )}
          {shipment && (
            <>
              <Block title="Container">
                <div className="font-semibold">{shipment.container_no}</div>
                <div className="text-stone-500">Seal {shipment.seal_no}</div>
              </Block>
              <Block title="Consignee">
                <div className="font-semibold">{buyer?.name ?? "—"}</div>
                <div className="text-stone-500">
                  {buyer?.country ?? shipment.destination_country}
                </div>
                <div className="text-stone-500">{buyer?.email}</div>
              </Block>
            </>
          )}
        </div>

        {/* quality */}
        {docType.blocks.includes("quality") && quality && (
          <Section title="Quality assessment">
            <table className="w-full">
              <tbody>
                <Tr label="Moisture" value={fmtPct(quality.moisture_pct)} />
                <Tr label="Fallen matter" value={fmtPct(quality.fallen_matter_pct)} />
                <Tr label="Total defects" value={fmtPct(quality.defect_pct)} />
                <Tr label="— black beans" value={fmtPct(quality.defect_breakdown.black_beans_pct)} sub />
                <Tr label="— broken" value={fmtPct(quality.defect_breakdown.broken_pct)} sub />
                <Tr label="— husks" value={fmtPct(quality.defect_breakdown.husks_pct)} sub />
                <Tr label="— insect damage" value={fmtPct(quality.defect_breakdown.insect_damage_pct)} sub />
                <Tr label="— foreign matter" value={fmtPct(quality.defect_breakdown.foreign_matter_pct)} sub />
                <Tr label="Recommended grade" value={quality.recommended_grade} strong />
              </tbody>
            </table>
          </Section>
        )}

        {/* costing */}
        {docType.blocks.includes("costing") && derived && (
          <Section title="Cost build-up (UGX/kg)">
            <table className="w-full">
              <tbody>
                {derived.components.map((c) => (
                  <Tr key={c.key} label={c.label} value={`${fmtUgx(c.per_kg)}/kg`} />
                ))}
                <Tr
                  label={derived.is_child ? "True cost / kg clean" : "Landed cost / kg"}
                  value={`${fmtUgx(derived.landed_cost_per_kg)}/kg`}
                  strong
                />
              </tbody>
            </table>
          </Section>
        )}

        {/* amount */}
        {docType.blocks.includes("amount") && batch && derived && (
          <Section title="Settlement">
            <table className="w-full">
              <tbody>
                <Tr label="Net payable weight" value={fmtKgLabel(derived.net_payable_weight_kg)} />
                <Tr label="Price / kg" value={fmtUgxLabel(derived.effective_price_per_kg)} />
                <Tr
                  label={type === "invoice" || type === "proforma" ? "Total landed cost" : "Amount payable"}
                  value={fmtUgxLabel(
                    type === "invoice" || type === "proforma"
                      ? derived.total_landed_cost
                      : derived.net_payable_weight_kg * batch.market_price_per_kg,
                  )}
                  strong
                />
                {(type === "invoice" || type === "proforma") && (
                  <Tr
                    label={`FOB @ $${fmtUsd(derived.selling_price_usd_per_kg)}/kg · rate ${fmtRate(liveRate)}`}
                    value={fmtUgxLabel(derived.revenue_ugx)}
                  />
                )}
              </tbody>
            </table>
          </Section>
        )}

        {/* contributors */}
        {docType.blocks.includes("contributors") && shipment && (
          <Section title="Contents — contributing batches">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-300 text-left text-stone-500">
                  <th className="py-1 font-medium">Batch</th>
                  <th className="py-1 font-medium">Farmer</th>
                  <th className="py-1 font-medium">District</th>
                  <th className="py-1 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.allocation.id} className="border-b border-stone-100">
                    <td className="py-1.5">{c.batch.batch_code}</td>
                    <td className="py-1.5">{c.supplier?.name ?? "—"}</td>
                    <td className="py-1.5">{c.batch.origin_district}</td>
                    <td className="py-1.5 text-right">{fmtKg(c.allocation.qty_kg)} kg</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5" colSpan={3}>Total</td>
                  <td className="py-1.5 text-right">
                    {fmtKg(contributions.reduce((s, c) => s + c.allocation.qty_kg, 0))} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
        )}

        {/* shipping */}
        {docType.blocks.includes("shipping") && shipment && (
          <Section title="Shipment">
            <table className="w-full">
              <tbody>
                <Tr label="Container" value={shipment.container_no} />
                <Tr label="Seal" value={shipment.seal_no} />
                <Tr label="Destination" value={shipment.destination_country} />
                <Tr label="Origin" value="Uganda" />
              </tbody>
            </table>
          </Section>
        )}

        {/* signature */}
        <div className="mt-10 flex justify-between gap-8 pt-6">
          <Signature label="Authorised by" />
          <Signature label="Received by" />
        </div>

        <p className="mt-8 text-center text-[10px] text-stone-400">
          Generated by CE-OS · This document reflects records at time of printing.
        </p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
        {title}
      </div>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-stone-200 py-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function Tr({
  label,
  value,
  strong,
  sub,
}: {
  label: string;
  value: string;
  strong?: boolean;
  sub?: boolean;
}) {
  return (
    <tr className={strong ? "border-t border-stone-300 font-semibold" : ""}>
      <td className={`py-1 ${sub ? "pl-4 text-stone-500" : ""}`}>{label}</td>
      <td className="py-1 text-right tabular-nums">{value}</td>
    </tr>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div className="flex-1">
      <div className="mt-8 border-t border-stone-400" />
      <div className="mt-1 text-xs text-stone-500">{label}</div>
    </div>
  );
}
