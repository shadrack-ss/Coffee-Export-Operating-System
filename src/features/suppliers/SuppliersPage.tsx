import { useState } from "react";
import { useData } from "@/core/store";
import { useAuth } from "@/core/auth";
import { useCreateSupplierApi, useUpdateSupplierApi, useSupplierReference } from "./api";
import type { Supplier, SupplierType } from "@/shared/types";
import { SUPPLIER_TYPES } from "@/shared/types";
import { PageHeader } from "@/shared/components/states";
import { Card, CardContent } from "@/shared/ui/card";
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
import { Combobox } from "@/shared/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Plus, Pencil, MapPin } from "lucide-react";

const TYPE_LABELS: Record<SupplierType, string> = {
  farmer: "Farmer",
  agent: "Agent",
  cooperative: "Cooperative",
  washing_station: "Washing Station",
  trader: "Trader",
};

const TYPE_VARIANT: Record<SupplierType, "default" | "primary" | "success" | "warning" | "outline"> = {
  farmer: "success",
  cooperative: "primary",
  washing_station: "warning",
  agent: "default",
  trader: "outline",
};

interface SupplierForm {
  name: string;
  type: string;
  district_id: string;
  contact: string;
  gps_lat: string;
  gps_lng: string;
}

const EMPTY_FORM: SupplierForm = {
  name: "",
  type: "",
  district_id: "",
  contact: "",
  gps_lat: "",
  gps_lng: "",
};

export function Suppliers() {
  const store = useData();
  const { can } = useAuth();
  const { suppliers } = store;
  const { data: ref } = useSupplierReference();

  const createSupplierApi = useCreateSupplierApi();
  const updateSupplierApi = useUpdateSupplierApi();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canManage = can("suppliers.manage");

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErr(null);
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    const district = ref?.districts.find((d) => d.name === s.origin_district);
    setEditing(s);
    setForm({
      name: s.name,
      type: s.type,
      district_id: district ? String(district.id) : "",
      contact: s.contact,
      gps_lat: s.gps?.lat != null ? String(s.gps.lat) : "",
      gps_lng: s.gps?.lng != null ? String(s.gps.lng) : "",
    });
    setErr(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      district_id: Number(form.district_id),
      contact: form.contact.trim(),
      gps_lat: form.gps_lat ? Number(form.gps_lat) : null,
      gps_lng: form.gps_lng ? Number(form.gps_lng) : null,
    };
    try {
      if (editing) {
        await updateSupplierApi(editing.id, payload);
      } else {
        await createSupplierApi(payload);
      }
      await store.refresh();
      setDialogOpen(false);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to save supplier");
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof SupplierForm, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        subtitle="Farmers, cooperatives, washing stations and agents who supply coffee."
        action={
          canManage && (
            <Button onClick={openAdd}>
              <Plus className="size-4" /> Add supplier
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="px-0">
          {suppliers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No suppliers yet. Add the first one to start recording GRNs.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">District</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">GPS</th>
                  {canManage && <th className="px-5 py-2 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-5 py-2.5 font-medium">{s.name}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={TYPE_VARIANT[s.type as SupplierType]}>
                        {TYPE_LABELS[s.type as SupplierType] ?? s.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {s.origin_district}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {s.contact}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.gps ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />
                          {s.gps.lat.toFixed(4)}, {s.gps.lng.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-5 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(s)}
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Kapchorwa Farmers Coop"
                required
                minLength={2}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">District</Label>
                <Combobox
                  options={(ref?.districts ?? []).map((d) => ({
                    value: String(d.id),
                    label: d.name,
                  }))}
                  value={form.district_id}
                  onChange={(v) => set("district_id", v)}
                  placeholder="Select district…"
                  searchPlaceholder="Search districts…"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Contact (phone / WhatsApp)</Label>
              <input
                className="input w-full"
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                placeholder="+256700000000"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">GPS coordinates (optional)</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  className="input w-full"
                  value={form.gps_lat}
                  onChange={(e) => set("gps_lat", e.target.value)}
                  placeholder="Latitude"
                  step="any"
                  min="-90"
                  max="90"
                />
                <input
                  type="number"
                  className="input w-full"
                  value={form.gps_lng}
                  onChange={(e) => set("gps_lng", e.target.value)}
                  placeholder="Longitude"
                  step="any"
                  min="-180"
                  max="180"
                />
              </div>
            </div>

            {err && <p className="text-xs text-danger">{err}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !form.type || !form.district_id}>
                {busy ? "Saving…" : editing ? "Save changes" : "Add supplier"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
