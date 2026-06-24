import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "@/core/store";
import { useAuth } from "@/core/auth";
import { useRecordProcessingApi } from "./api";
import { batchFinancials } from "@/features/batches";
import { computeProcessing } from "@/shared/calc";
import { PageHeader, EmptyState } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { fmtUgx, fmtUgxLabel, fmtKg, fmtKgLabel, fmtPct } from "@/shared/lib/money";
import type { ProcessType } from "@/shared/types";
import { Cog, ArrowRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const PROCESS_TYPES: ProcessType[] = [
  "hulling",
  "cleaning",
  "sorting",
  "drying",
  "re-grading",
  "re-bagging",
];

export function Processing() {
  const data = useData();
  const recordProcessingApi = useRecordProcessingApi();
  const { can } = useAuth();
  const navigate = useNavigate();
  const canRecord = can("grn.create");
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;

  // eligible inputs: intakes (not themselves processing outputs)
  const eligible = data.batches.filter((b) => !b.parent_batch_id);
  const [batchId, setBatchId] = useState(eligible[0]?.id ?? "");
  const batch = data.batches.find((b) => b.id === batchId);

  const derived = useMemo(
    () => (batch ? batchFinancials(batch, data, liveRate) : null),
    [batch, data, liveRate],
  );

  const [inputKg, setInputKg] = useState("");
  const [outputKg, setOutputKg] = useState("");
  const [processType, setProcessType] = useState<ProcessType>("hulling");

  const inKg = parseFloat(inputKg) || derived?.net_payable_weight_kg || 0;
  const outKg = parseFloat(outputKg) || 0;

  const preview = useMemo(
    () => computeProcessing(inKg, outKg, derived?.total_landed_cost ?? 0),
    [inKg, outKg, derived],
  );

  const valid =
    !!batch && inKg > 0 && outKg > 0 && outKg <= inKg;

  const record = async () => {
    if (!valid || !batch) return;
    const input = {
      input_batch_id: batch.id,
      input_kg: inKg,
      output_kg: outKg,
      process_type: processType,
    };
    const res = await recordProcessingApi(input);
    await data.refresh();
    if (res.child_batch_id) navigate(`/batches/${res.child_batch_id}`);
  };

  const batchCode = (id: string) =>
    data.batches.find((b) => b.id === id)?.batch_code ?? id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processing"
        subtitle="Record a change of form. Yield, loss and the true cost of the clean output compute live."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record processing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Input batch</Label>
              <Select value={batchId} onValueChange={(v) => { setBatchId(v); setInputKg(""); setOutputKg(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a batch…" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_code} · {b.coffee_grade} · {b.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {derived && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available (net)</span>
                  <span className="tnum tabular-nums">
                    {fmtKgLabel(derived.net_payable_weight_kg)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Accumulated cost
                  </span>
                  <span className="tnum tabular-nums">
                    {fmtUgxLabel(derived.total_landed_cost)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Process type</Label>
              <Select
                value={processType}
                onValueChange={(v) => setProcessType(v as ProcessType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROCESS_TYPES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p.replace(/-/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Input kg</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={inputKg}
                  onChange={(e) => setInputKg(e.target.value)}
                  placeholder={derived ? fmtKg(derived.net_payable_weight_kg) : "0"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Clean output kg</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={outputKg}
                  onChange={(e) => setOutputKg(e.target.value)}
                  aria-invalid={outKg > inKg}
                  placeholder="0"
                />
              </div>
            </div>
            {outKg > inKg && (
              <p className="text-xs text-danger">
                Output cannot exceed input.
              </p>
            )}

            <Button
              onClick={record}
              disabled={!valid || !canRecord}
              className="w-full"
            >
              <Cog className="size-4" /> Record processing &amp; create child batch
            </Button>
            {!canRecord && (
              <p className="text-center text-xs text-muted-foreground">
                Your role can view processing but cannot record it.
              </p>
            )}
          </CardContent>
        </Card>

        {/* live preview */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Yield &amp; re-cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Metric label="Yield" value={`${fmtPct(preview.yield_pct)}`} tone="primary" />
              <Metric label="Loss" value={fmtKg(preview.loss_kg)} unit="kg" />
              <Metric label="Output" value={fmtKg(preview.output_kg)} unit="kg" />
            </div>

            <div className="space-y-2 border-t border-border pt-3 text-sm">
              <Row label="Input weight" value={fmtKgLabel(preview.input_kg)} />
              <Row
                label="Accumulated cost carried"
                value={fmtUgxLabel(derived?.total_landed_cost ?? 0)}
              />
            </div>

            <div className="rounded-md bg-primary/5 p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                True cost / kg of clean output
              </div>
              <div className="tnum mt-1 text-2xl font-semibold tabular-nums">
                {fmtUgx(preview.true_cost_per_kg_clean)} UGX/kg
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The full intake cost now rides on {fmtKg(preview.output_kg)} kg
                of sellable coffee.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* lineage */}
      <Card>
        <CardHeader>
          <CardTitle>Processing history</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {data.processing.length === 0 ? (
            <EmptyState
              icon={Cog}
              title="No processing recorded yet"
              description="Record a change of form above to start the lineage."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Process</th>
                    <th className="px-3 py-2 font-medium">Input → Output</th>
                    <th className="px-3 py-2 text-right font-medium">Yield</th>
                    <th className="px-3 py-2 text-right font-medium">Loss</th>
                    <th className="px-5 py-2 font-medium">Child batch</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.processing]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-5 py-2.5 capitalize">
                          {p.process_type.replace(/-/g, " ")}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            <Link
                              to={`/batches/${p.input_batch_id}`}
                              className="hover:text-primary hover:underline"
                            >
                              {batchCode(p.input_batch_id)}
                            </Link>
                            <ArrowRight className="size-3 text-muted-foreground" />
                            <span className="tnum tabular-nums text-muted-foreground">
                              {fmtKg(p.input_kg)}→{fmtKg(p.output_kg)} kg
                            </span>
                          </span>
                        </td>
                        <td className="tnum px-3 py-2.5 text-right tabular-nums">
                          {fmtPct(p.yield_pct)}
                        </td>
                        <td className="tnum px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {fmtKg(p.loss_kg)} kg
                        </td>
                        <td className="px-5 py-2.5">
                          <Link
                            to={`/batches/${p.output_batch_id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {batchCode(p.output_batch_id)}
                          </Link>
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

function Metric({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "primary";
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "tnum mt-1 text-lg font-semibold tabular-nums",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tnum font-medium tabular-nums">{value}</span>
    </div>
  );
}
