import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/core/store";
import { useAuth } from "@/core/auth";
import { allBatchFinancials } from "./selectors";
import { PageHeader, EmptyState } from "@/shared/components/states";
import { StatusBadge, RiskBadge } from "@/shared/components/badges";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { fmtUgx, fmtKg } from "@/shared/lib/money";
import { Search, Boxes, Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function Batches() {
  const data = useData();
  const { can } = useAuth();
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;
  const [q, setQ] = useState("");

  const fin = useMemo(
    () => allBatchFinancials(data, liveRate),
    [data, liveRate],
  );

  const supplierName = (id: string) =>
    data.suppliers.find((s) => s.id === id)?.name ?? "—";

  const rows = fin.filter((f) => {
    if (!q.trim()) return true;
    const hay =
      `${f.batch.batch_code} ${f.batch.origin_district} ${supplierName(f.batch.supplier_id)} ${f.batch.coffee_grade}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batches"
        subtitle="Every intake, its derived net payable weight, landed cost and margin risk."
        action={
          can("grn.create") ? (
            <Button asChild>
              <Link to="/batches/new">
                <Plus className="size-4" /> New GRN
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search batch code, district, supplier, grade…"
          aria-label="Search batches"
          className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No matching batches"
          description="Try a different search term, or clear the filter."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Batch</th>
                  <th className="px-3 py-2.5 font-medium">Supplier</th>
                  <th className="px-3 py-2.5 font-medium">Grade</th>
                  <th className="px-3 py-2.5 text-right font-medium">Net kg</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Landed/kg
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">P/L</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr
                    key={f.batch.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/batches/${f.batch.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {f.batch.batch_code}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {f.batch.origin_district}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {supplierName(f.batch.supplier_id)}
                    </td>
                    <td className="px-3 py-3">{f.batch.coffee_grade}</td>
                    <td className="tnum px-3 py-3 text-right tabular-nums">
                      {f.net_payable_weight_kg
                        ? fmtKg(f.net_payable_weight_kg)
                        : "—"}
                    </td>
                    <td className="tnum px-3 py-3 text-right tabular-nums">
                      {f.landed_cost_per_kg
                        ? fmtUgx(f.landed_cost_per_kg)
                        : "—"}
                    </td>
                    <td
                      className={cn(
                        "tnum px-3 py-3 text-right font-medium tabular-nums",
                        f.profit_loss_ugx >= 0
                          ? "text-success"
                          : "text-danger",
                      )}
                    >
                      {f.revenue_ugx > 0 ? fmtUgx(f.profit_loss_ugx) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={f.batch.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {f.revenue_ugx > 0 ? (
                        <RiskBadge risk={f.risk} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
