import { useState } from "react";
import { useData } from "@/core/store";
import { useAuth } from "@/core/auth";
import { PageHeader } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useCreateShipmentApi, useAllocateBatchApi } from "./api";
import { Container, Plus } from "lucide-react";
import type { Shipment } from "@/shared/types";

interface ShipForm {
  container_no: string;
  seal_no: string;
  buyer_id: string;
  destination_country: string;
}

export function Shipments() {
  const store = useData();
  const { can } = useAuth();
  const { shipments, allocations, clients, batches } = store;

  const createShipmentApi = useCreateShipmentApi();
  const allocateBatchApi = useAllocateBatchApi();

  const [showCreate, setShowCreate] = useState(false);
  const [allocTarget, setAllocTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<ShipForm>({
    container_no: "", seal_no: "", buyer_id: "", destination_country: "",
  });
  const [allocForm, setAllocForm] = useState({ batch_id: "", qty_kg: "" });

  // Approved batches available for allocation
  const allocatable = batches.filter((b) =>
    b.status === "approved" || b.status === "allocated",
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createShipmentApi(form);
      await store.refresh();
      setShowCreate(false);
      setForm({ container_no: "", seal_no: "", buyer_id: "", destination_country: "" });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to create shipment");
    } finally {
      setBusy(false);
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocTarget) return;
    const qty = parseFloat(allocForm.qty_kg);
    if (!qty || qty <= 0) { setErr("Enter a valid quantity"); return; }
    setBusy(true);
    setErr(null);
    try {
      await allocateBatchApi(allocTarget, { batch_id: allocForm.batch_id, qty_kg: qty });
      await store.refresh();
      setAllocTarget(null);
      setAllocForm({ batch_id: "", qty_kg: "" });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to allocate batch");
    } finally {
      setBusy(false);
    }
  };

  const canManage = can("payment.approve");

  const buyerName = (s: Shipment) =>
    clients.find((c) => c.id === s.buyer_id)?.name ?? s.buyer_id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments"
        subtitle="Export containers and batch allocations."
        action={
          canManage ? (
            <Button onClick={() => { setShowCreate(true); setErr(null); }}>
              <Plus className="size-4" /> New shipment
            </Button>
          ) : undefined
        }
      />

      {shipments.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Container className="size-10 opacity-30" />
          <p className="text-sm">No shipments yet. Create one to start allocating batches.</p>
        </div>
      )}

      <div className="grid gap-4">
        {shipments.map((s) => {
          const lines = allocations.filter((a) => a.shipment_id === s.id);
          const totalKg = lines.reduce((sum, a) => sum + a.qty_kg, 0);

          return (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {s.container_no}
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Seal {s.seal_no} · {buyerName(s)} · {s.destination_country}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{totalKg.toLocaleString()} kg</Badge>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setAllocTarget(s.id); setErr(null); setAllocForm({ batch_id: "", qty_kg: "" }); }}
                      >
                        <Plus className="size-3.5" /> Allocate batch
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {lines.length > 0 && (
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Batch</th>
                        <th className="py-2 pr-4 font-medium">Grade</th>
                        <th className="py-2 font-medium text-right">Qty (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((a) => {
                        const b = batches.find((x) => x.id === a.batch_id);
                        return (
                          <tr key={a.id} className="border-b border-border/50 last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs">
                              {b?.batch_code ?? a.batch_id.slice(0, 8)}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {b?.coffee_grade ?? "—"}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {a.qty_kg.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* New shipment dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New shipment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Container no.</Label>
                <input
                  className="input w-full"
                  value={form.container_no}
                  onChange={(e) => setForm({ ...form, container_no: e.target.value })}
                  placeholder="MSCU1234567"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seal no.</Label>
                <input
                  className="input w-full"
                  value={form.seal_no}
                  onChange={(e) => setForm({ ...form, seal_no: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Buyer</Label>
              <Select
                value={form.buyer_id}
                onValueChange={(v) => setForm({ ...form, buyer_id: v })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select buyer…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Destination country</Label>
              <input
                className="input w-full"
                value={form.destination_country}
                onChange={(e) => setForm({ ...form, destination_country: e.target.value })}
                required
              />
            </div>
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !form.buyer_id}>
                {busy ? "Creating…" : "Create shipment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Allocate batch dialog */}
      <Dialog
        open={allocTarget !== null}
        onOpenChange={(open) => { if (!open) setAllocTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate batch to container</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAllocate} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Batch</Label>
              <Select
                value={allocForm.batch_id}
                onValueChange={(v) => setAllocForm({ ...allocForm, batch_id: v })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select approved batch…" />
                </SelectTrigger>
                <SelectContent>
                  {allocatable.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_code} — {b.coffee_grade} ({b.clean_output_kg ?? b.net_payable_weight_kg} kg)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allocatable.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No approved batches available. Approve payments first.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity (kg)</Label>
              <input
                type="number"
                className="input w-full"
                value={allocForm.qty_kg}
                onChange={(e) => setAllocForm({ ...allocForm, qty_kg: e.target.value })}
                min="0.001"
                step="0.001"
                required
              />
            </div>
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setAllocTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !allocForm.batch_id}>
                {busy ? "Allocating…" : "Allocate"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
