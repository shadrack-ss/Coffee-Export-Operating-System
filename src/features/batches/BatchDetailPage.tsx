import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "@/core/store";
import { batchFinancials } from "./selectors";
import { computeQuality, type DerivationStep } from "@/shared/calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { PageHeader, EmptyState } from "@/shared/components/states";
import { StatusBadge, RiskBadge } from "@/shared/components/badges";
import { QualityWorking } from "@/shared/components/QualityWorking";
import { Badge } from "@/shared/ui/badge";
import {
  fmtUgx,
  fmtUgxLabel,
  fmtKgLabel,
  fmtPct,
  fmtUsd,
  fmtRate,
} from "@/shared/lib/money";
import { ArrowLeft, TrendingUp, GitBranch } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function BatchDetail() {
  const { id } = useParams();
  const data = useData();
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;

  const batch = data.batches.find((b) => b.id === id);

  const derived = useMemo(() => {
    if (!batch) return null;
    return batchFinancials(batch, data, liveRate);
  }, [batch, data, liveRate]);

  const qualitySteps = useMemo<DerivationStep[]>(() => {
    if (!batch || !derived?.quality) return [];
    return computeQuality(
      {
        gross_weight_kg: batch.gross_weight_kg,
        tare_weight_kg: batch.tare_weight_kg,
        moisture_pct: derived.quality.moisture_pct,
        fallen_matter_pct: derived.quality.fallen_matter_pct,
        defect_pct: derived.quality.defect_pct,
        defect_handling_mode: derived.quality.defect_handling_mode,
        market_price_per_kg: batch.market_price_per_kg,
      },
      data.settings,
    ).steps;
  }, [batch, derived, data.settings]);

  if (!batch || !derived) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          title="Batch not found"
          description="This batch code doesn't exist. It may have been removed."
        />
      </div>
    );
  }

  const supplier = data.suppliers.find((s) => s.id === batch.supplier_id);
  const buyer = data.clients.find((c) => c.id === batch.buyer_id);

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={batch.batch_code}
        subtitle={`${batch.coffee_grade} · ${batch.origin_district} · ${supplier?.name ?? "—"}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={batch.status} />
            {derived.revenue_ugx > 0 && <RiskBadge risk={derived.risk} />}
          </div>
        }
      />

      {/* summary strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Net payable weight" value={fmtKgLabel(derived.net_payable_weight_kg)} />
        <Stat label="Landed cost / kg" value={fmtUgxLabel(derived.landed_cost_per_kg)} />
        <Stat label="Total landed cost" value={fmtUgxLabel(derived.total_landed_cost)} />
        <Stat
          label="Projected P/L"
          value={fmtUgxLabel(derived.profit_loss_ugx)}
          tone={derived.profit_loss_ugx >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Quality derivation — show working */}
        <Card>
          <CardHeader>
            <CardTitle>Quality — net payable weight</CardTitle>
          </CardHeader>
          <CardContent>
            {derived.quality ? (
              <>
                <div className="mb-4 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    Moisture {fmtPct(derived.quality.moisture_pct)}
                  </Badge>
                  <Badge variant="outline">
                    Fallen matter {fmtPct(derived.quality.fallen_matter_pct)}
                  </Badge>
                  <Badge variant="outline">
                    Defects {fmtPct(derived.quality.defect_pct)}
                  </Badge>
                  <Badge variant="primary">
                    {derived.quality.recommended_grade}
                  </Badge>
                </div>
                <QualityWorking
                  steps={qualitySteps}
                  grossWeight={batch.gross_weight_kg}
                />
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="font-medium">Amount payable to farmer</span>
                  <span className="tnum font-semibold tabular-nums">
                    {fmtUgxLabel(
                      derived.net_payable_weight_kg *
                        derived.batch.market_price_per_kg,
                    )}
                  </span>
                </div>
              </>
            ) : (
              <EmptyState
                title="Not yet graded"
                description="This batch is awaiting quality grading. The live calculator lands in Phase 2."
              />
            )}
          </CardContent>
        </Card>

        {/* Costing build-up */}
        <Card>
          <CardHeader>
            <CardTitle>
              {derived.is_child ? "Re-costed (clean output)" : "Landed cost build-up"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(
              <table className="w-full text-sm">
                <tbody>
                  {derived.components.map((c) => (
                    <tr key={c.key} className="border-b border-border/50">
                      <td className="py-1.5">
                        {c.label}
                        {c.usd_linked && (
                          <Badge variant="warning" className="ml-2">
                            ↑ USD-linked
                          </Badge>
                        )}
                        {c.allocation_group_id && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            allocated · {c.allocation_group_id}
                          </span>
                        )}
                      </td>
                      <td className="tnum py-1.5 text-right tabular-nums text-muted-foreground">
                        {fmtUgx(c.per_kg)}/kg
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="pt-2.5">
                      {derived.is_child ? "True cost / kg clean" : "Landed cost / kg"}
                    </td>
                    <td className="tnum pt-2.5 text-right tabular-nums">
                      {fmtUgx(derived.landed_cost_per_kg)}/kg
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> Financials &amp; forex
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Selling price" value={`$${fmtUsd(derived.selling_price_usd_per_kg)}/kg`} />
          <Stat label="Live USD/UGX" value={fmtRate(liveRate)} />
          <Stat
            label="Locked at costing"
            value={derived.locked_rate ? fmtRate(derived.locked_rate) : "—"}
            hint={
              derived.locked_rate
                ? `${liveRate - derived.locked_rate >= 0 ? "+" : ""}${fmtRate(liveRate - derived.locked_rate)} since`
                : undefined
            }
          />
          <Stat label="Break-even" value={`$${fmtUsd(derived.breakeven_usd_per_kg)}/kg`} />
          <Stat
            label="Margin"
            value={fmtPct(derived.margin_pct)}
            tone={derived.margin_pct >= data.settings.target_margin_pct ? "success" : derived.margin_pct >= 0 ? "warning" : "danger"}
          />
        </CardContent>
      </Card>

      {(() => {
        const asChild = data.processing.find(
          (p) => p.output_batch_id === batch.id,
        );
        const asParent = data.processing.filter(
          (p) => p.input_batch_id === batch.id,
        );
        if (!asChild && asParent.length === 0) return null;
        const parent = batch.parent_batch_id
          ? data.batches.find((b) => b.id === batch.parent_batch_id)
          : undefined;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="size-4 text-primary" /> Lineage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {asChild && parent && (
                <p>
                  {asChild.process_type.replace(/-/g, " ")} of{" "}
                  <Link
                    to={`/batches/${parent.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {parent.batch_code}
                  </Link>{" "}
                  · yield {fmtPct(asChild.yield_pct)} · loss{" "}
                  {fmtKgLabel(asChild.loss_kg)}
                </p>
              )}
              {asParent.map((p) => {
                const child = data.batches.find(
                  (b) => b.id === p.output_batch_id,
                );
                return (
                  <p key={p.id}>
                    {p.process_type.replace(/-/g, " ")} →{" "}
                    <Link
                      to={`/batches/${p.output_batch_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {child?.batch_code ?? p.output_batch_id}
                    </Link>{" "}
                    · {fmtKgLabel(p.input_kg)} → {fmtKgLabel(p.output_kg)} ·
                    yield {fmtPct(p.yield_pct)}
                  </p>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {buyer && (
        <p className="text-sm text-muted-foreground">
          Allocated to{" "}
          <span className="font-medium text-foreground">{buyer.name}</span> ·{" "}
          {buyer.country}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "",
    success: "text-success",
    warning: "text-warning-foreground",
    danger: "text-danger",
  }[tone];
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("tnum mt-1 text-lg font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/batches"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> All batches
    </Link>
  );
}
