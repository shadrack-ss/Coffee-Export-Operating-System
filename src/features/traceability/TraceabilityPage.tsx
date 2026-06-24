import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/core/store";
import {
  containerContributions,
  batchChain,
  shipmentSummaries,
} from "./selectors";
import { PageHeader, EmptyState } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { fmtKgLabel, fmtPct } from "@/shared/lib/money";
import {
  Container,
  GitBranch,
  MapPin,
  Sprout,
  Printer,
  Ship,
  User2,
  Factory,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

type Mode = "container" | "batch";

const STAGE_ICON: Record<string, typeof Sprout> = {
  Source: Sprout,
  "Intake / GRN": MapPin,
  Processing: Factory,
  "Export container": Ship,
  Buyer: User2,
};

export function Traceability() {
  const data = useData();
  const [mode, setMode] = useState<Mode>("container");

  const summaries = useMemo(() => shipmentSummaries(data), [data]);
  const [shipmentId, setShipmentId] = useState(data.shipments[0]?.id ?? "");
  const [batchId, setBatchId] = useState(
    data.batches.find((b) => data.allocations.some((a) => a.batch_id === b.id))
      ?.id ??
      data.batches[0]?.id ??
      "",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Traceability"
        subtitle="Farmer → GRN → warehouse → processing → container → buyer, and the reverse."
        action={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print sheet
          </Button>
        }
      />

      <div className="inline-flex rounded-md border border-border p-0.5">
        <TabButton active={mode === "container"} onClick={() => setMode("container")}>
          <Container className="size-4" /> By container
        </TabButton>
        <TabButton active={mode === "batch"} onClick={() => setMode("batch")}>
          <GitBranch className="size-4" /> By batch
        </TabButton>
      </div>

      {mode === "container" ? (
        <ContainerView
          summaries={summaries}
          shipmentId={shipmentId}
          setShipmentId={setShipmentId}
        />
      ) : (
        <BatchView batchId={batchId} setBatchId={setBatchId} />
      )}
    </div>
  );
}

function ContainerView({
  summaries,
  shipmentId,
  setShipmentId,
}: {
  summaries: ReturnType<typeof shipmentSummaries>;
  shipmentId: string;
  setShipmentId: (v: string) => void;
}) {
  const data = useData();
  const contributions = useMemo(
    () => containerContributions(shipmentId, data),
    [shipmentId, data],
  );
  const shipment = data.shipments.find((s) => s.id === shipmentId);
  const buyer = shipment
    ? data.clients.find((c) => c.id === shipment.buyer_id)
    : undefined;

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Label className="mb-1.5 block">Container / shipment</Label>
        <Select value={shipmentId} onValueChange={setShipmentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a container…" />
          </SelectTrigger>
          <SelectContent>
            {summaries.map((s) => (
              <SelectItem key={s.shipment.id} value={s.shipment.id}>
                {s.shipment.container_no} → {s.shipment.destination_country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!shipment ? (
        <EmptyState icon={Container} title="No container selected" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Ship className="size-4 text-primary" />
              {shipment.container_no}
              <span className="text-sm font-normal text-muted-foreground">
                seal {shipment.seal_no} → {shipment.destination_country}
                {buyer ? ` · ${buyer.name}` : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <p className="px-5 pb-3 text-sm text-muted-foreground">
              Whose coffee is in this container — every contributing batch traced
              to its source farmer, district and quality.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Batch (in container)</th>
                    <th className="px-3 py-2 font-medium">Source farmer</th>
                    <th className="px-3 py-2 font-medium">District</th>
                    <th className="px-3 py-2 font-medium">Quality (intake)</th>
                    <th className="px-5 py-2 text-right font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => (
                    <tr
                      key={c.allocation.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-5 py-2.5">
                        <Link
                          to={`/batches/${c.batch.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {c.batch.batch_code}
                        </Link>
                        {c.batch.parent_batch_id && (
                          <div className="text-xs text-muted-foreground">
                            from {c.rootBatch.batch_code}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.supplier?.name ?? "—"}
                        <div className="text-xs text-muted-foreground capitalize">
                          {c.supplier?.type.replace(/_/g, " ")}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {c.batch.origin_district}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.rootQuality ? (
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">
                              MC {fmtPct(c.rootQuality.moisture_pct)}
                            </Badge>
                            <Badge variant="outline">
                              Def {fmtPct(c.rootQuality.defect_pct)}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="tnum px-5 py-2.5 text-right tabular-nums">
                        {fmtKgLabel(c.allocation.qty_kg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td className="px-5 py-2.5" colSpan={4}>
                      {contributions.length} contributing batch(es)
                    </td>
                    <td className="tnum px-5 py-2.5 text-right tabular-nums">
                      {fmtKgLabel(
                        contributions.reduce((s, c) => s + c.allocation.qty_kg, 0),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BatchView({
  batchId,
  setBatchId,
}: {
  batchId: string;
  setBatchId: (v: string) => void;
}) {
  const data = useData();
  const batch = data.batches.find((b) => b.id === batchId);
  const chain = useMemo(
    () => (batch ? batchChain(batch, data) : []),
    [batch, data],
  );

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Label className="mb-1.5 block">Batch</Label>
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a batch…" />
          </SelectTrigger>
          <SelectContent>
            {data.batches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.batch_code} · {b.coffee_grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!batch ? (
        <EmptyState icon={GitBranch} title="No batch selected" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Chain · {batch.batch_code}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-0">
              {chain.map((node, i) => {
                const Icon = STAGE_ICON[node.stage] ?? MapPin;
                const last = i === chain.length - 1;
                return (
                  <li key={node.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-[18px]" />
                      </span>
                      {!last && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className={cn("pb-6", last && "pb-0")}>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {node.stage}
                      </div>
                      <div className="font-medium">
                        {node.to ? (
                          <Link
                            to={node.to}
                            className="hover:text-primary hover:underline"
                          >
                            {node.title}
                          </Link>
                        ) : (
                          node.title
                        )}
                      </div>
                      {node.subtitle && (
                        <div className="text-sm text-muted-foreground">
                          {node.subtitle}
                        </div>
                      )}
                      {node.meta && (
                        <div className="text-xs text-muted-foreground">
                          GPS {node.meta}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
