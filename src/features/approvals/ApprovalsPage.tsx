import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/core/store";
import { useAuth } from "@/core/auth";
import { useApproveBatchApi } from "./api";
import { allBatchFinancials } from "@/features/batches";
import { PageHeader, EmptyState } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { StatusBadge } from "@/shared/components/badges";
import { fmtUgx, fmtUgxLabel, fmtKg } from "@/shared/lib/money";
import { CheckCircle2, ShieldCheck } from "lucide-react";

const PENDING = ["graded", "costed", "processed"];

export function Approvals() {
  const data = useData();
  const { can } = useAuth();
  const approveApi = useApproveBatchApi();
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;
  const canApprove = can("payment.approve");
  const [busy, setBusy] = useState<string | null>(null);

  const fin = useMemo(
    () => allBatchFinancials(data, liveRate),
    [data, liveRate],
  );

  const supplierName = (id: string) =>
    data.suppliers.find((s) => s.id === id)?.name ?? "—";

  const queue = fin.filter(
    (f) =>
      PENDING.includes(f.batch.status) && f.batch.net_payable_weight_kg != null,
  );

  const approve = async (batchId: string) => {
    setBusy(batchId);
    try {
      await approveApi(batchId);
      await data.refresh();
    } finally {
      setBusy(null);
    }
  };

  const history = [...data.approvals].sort((a, b) =>
    b.approved_at.localeCompare(a.approved_at),
  );
  const batchCode = (id: string) =>
    data.batches.find((b) => b.id === id)?.batch_code ?? id;
  const userName = (id: string) =>
    data.users.find((u) => u.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        subtitle="Outgoing-cash approval queue. One click writes the approval, advances the batch, and logs the audit trail."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> Awaiting approval
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {queue.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing awaiting approval"
              description="Graded and costed batches appear here for cash sign-off."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Batch</th>
                    <th className="px-3 py-2 font-medium">Supplier</th>
                    <th className="px-3 py-2 text-right font-medium">Net kg</th>
                    <th className="px-3 py-2 text-right font-medium">Landed/kg</th>
                    <th className="px-3 py-2 text-right font-medium">Amount payable</th>
                    <th className="px-5 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((f) => {
                    const amount = Math.round(
                      f.net_payable_weight_kg * f.batch.market_price_per_kg,
                    );
                    return (
                      <tr
                        key={f.batch.id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-5 py-3">
                          <Link
                            to={`/batches/${f.batch.id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {f.batch.batch_code}
                          </Link>
                          <div className="mt-0.5">
                            <StatusBadge status={f.batch.status} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {supplierName(f.batch.supplier_id)}
                        </td>
                        <td className="tnum px-3 py-3 text-right tabular-nums text-muted-foreground">
                          {fmtKg(f.net_payable_weight_kg)}
                        </td>
                        <td className="tnum px-3 py-3 text-right tabular-nums text-muted-foreground">
                          {fmtUgx(f.landed_cost_per_kg)}
                        </td>
                        <td className="tnum px-3 py-3 text-right font-semibold tabular-nums">
                          {fmtUgxLabel(amount)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {canApprove ? (
                            <Button
                              size="sm"
                              onClick={() => approve(f.batch.id)}
                              disabled={busy === f.batch.id}
                            >
                              <CheckCircle2 className="size-4" />
                              {busy === f.batch.id ? "Approving…" : "Approve"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              admin only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approved</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No approvals yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Batch</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Approved by</th>
                    <th className="px-5 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-5 py-2.5">
                        <Link
                          to={`/batches/${a.batch_id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {batchCode(a.batch_id)}
                        </Link>
                      </td>
                      <td className="tnum px-3 py-2.5 text-right tabular-nums">
                        {fmtUgxLabel(a.amount_ugx)}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {userName(a.approved_by)}
                      </td>
                      <td className="px-5 py-2.5 text-muted-foreground">
                        {new Date(a.approved_at).toLocaleString("en-UG", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
