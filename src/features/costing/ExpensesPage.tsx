import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/core/store";
import {
  useAddExpenseApi,
  useDeleteExpenseApi,
  type ExpenseInput,
} from "./api";
import { useAuth } from "@/core/auth";
import { batchFinancials } from "@/features/batches";
import { suggestedGunnyPerKg } from "@/shared/calc";
import { PageHeader, EmptyState } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { fmtUgx, fmtUgxLabel, fmtKgLabel } from "@/shared/lib/money";
import type { ExpenseBasis } from "@/shared/types";
import { Trash2, Plus, Receipt, TrendingUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function Expenses() {
  const data = useData();
  const { can } = useAuth();
  const addExpenseApi = useAddExpenseApi();
  const deleteExpenseApi = useDeleteExpenseApi();
  const editable = can("expense.edit");
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;

  // writes go to the API, then re-pull the snapshot
  const onAddExpense = async (input: ExpenseInput) => {
    await addExpenseApi(input);
    await data.refresh();
  };
  const onDeleteExpense = async (id: string) => {
    await deleteExpenseApi(id);
    await data.refresh();
  };

  // batches that can carry costs (exclude unyet-graded intakes are fine too)
  const costable = data.batches;
  const [batchId, setBatchId] = useState(costable[0]?.id ?? "");
  const batch = data.batches.find((b) => b.id === batchId);

  const derived = useMemo(
    () => (batch ? batchFinancials(batch, data, liveRate) : null),
    [batch, data, liveRate],
  );

  const lines = data.expenses.filter((e) => e.batch_id === batchId);

  // gunny-bags USD-linked recompute suggestion
  const suggestedGunny = suggestedGunnyPerKg(data.settings, liveRate);
  const gunnyDrift = suggestedGunny !== data.settings.gunny_bags_per_kg;

  const applyGunny = () =>
    data.update({
      settings: {
        ...data.settings,
        gunny_bags_per_kg: suggestedGunny,
        gunny_bags_usd_ref_rate: liveRate,
      },
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Attach per-kg and allocated-group costs to a batch. The landed-cost build-up updates live."
      />

      <div className="max-w-sm">
        <Label className="mb-1.5 block">Batch</Label>
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a batch…" />
          </SelectTrigger>
          <SelectContent>
            {costable.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.batch_code} · {b.coffee_grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!batch || !derived ? (
        <EmptyState icon={Receipt} title="No batch selected" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* build-up */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                {derived.is_child ? "Re-costed (clean output)" : "Landed cost build-up"}
              </CardTitle>
              <Link
                to={`/batches/${batch.id}`}
                className="text-xs text-primary hover:underline"
              >
                Open batch
              </Link>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
                        {c.basis === "allocated" && c.allocation_group_id && (
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
                  <tr className="text-muted-foreground">
                    <td className="pt-1">
                      Total landed ({fmtKgLabel(derived.quantity_kg)})
                    </td>
                    <td className="tnum pt-1 text-right tabular-nums">
                      {fmtUgxLabel(derived.total_landed_cost)}
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>

              {gunnyDrift && (
                <div className="mt-4 rounded-md bg-warning-muted px-3 py-2 text-xs text-warning-foreground">
                  Gunny bags are USD-linked. At the live rate the suggested rate
                  is <strong>{fmtUgx(suggestedGunny)} UGX/kg</strong> (currently{" "}
                  {fmtUgx(data.settings.gunny_bags_per_kg)}).{" "}
                  {can("settings.edit") ? (
                    <button
                      onClick={applyGunny}
                      className="font-medium underline underline-offset-2"
                    >
                      Apply recompute
                    </button>
                  ) : (
                    <span>Ask an admin to recompute in Settings.</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* expense lines */}
          <Card>
            <CardHeader>
              <CardTitle>Expense lines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expense lines on this batch yet. The per-kg defaults (tax,
                  handling, gunny bags, paperwork) come from Settings.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {lines.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{l.category}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.basis === "allocated"
                            ? `allocated${l.allocation_group_id ? ` · ${l.allocation_group_id}` : ""}`
                            : "per kg"}
                          {l.note ? ` · ${l.note}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tnum tabular-nums">
                          {fmtUgxLabel(l.amount_ugx)}
                          {l.basis === "per_kg" && "/kg"}
                        </span>
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-danger"
                            onClick={() => void onDeleteExpense(l.id)}
                            aria-label="Delete expense line"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {editable ? (
                <AddExpenseForm
                  onAdd={(input) => void onAddExpense(input)}
                  batchId={batch.id}
                  categories={data.settings.expense_categories}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your role can view costing but cannot edit expenses.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function AddExpenseForm({
  onAdd,
  batchId,
  categories,
}: {
  onAdd: (input: ExpenseInput) => void;
  batchId: string;
  categories: string[];
}) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [basis, setBasis] = useState<ExpenseBasis>("allocated");
  const [group, setGroup] = useState("");
  const [note, setNote] = useState("");

  const amountNum = parseFloat(amount);
  const valid = !!category && Number.isFinite(amountNum) && amountNum > 0;

  const submit = () => {
    if (!valid) return;
    onAdd({
      batch_id: batchId,
      category,
      amount_ugx: Math.round(amountNum),
      basis,
      allocation_group_id: basis === "allocated" ? group || `ag-${Date.now()}` : null,
      note: note || undefined,
    });
    setCategory("");
    setAmount("");
    setGroup("");
    setNote("");
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="text-sm font-medium">Add expense</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Amount {basis === "per_kg" ? "(UGX/kg)" : "(UGX total)"}
          </Label>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-10"
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Basis</Label>
        <div className="flex gap-2">
          <BasisButton active={basis === "allocated"} onClick={() => setBasis("allocated")} title="Allocated" desc="Spread total across the group's kg." />
          <BasisButton active={basis === "per_kg"} onClick={() => setBasis("per_kg")} title="Per kg" desc="A flat UGX/kg rate." />
        </div>
      </div>

      {basis === "allocated" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Allocation group (optional)</Label>
          <Input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="h-10"
            placeholder="e.g. ag-transport-jun (blank = this batch only)"
          />
          <p className="text-xs text-muted-foreground">
            Reuse the same group id on other batches to split one lump sum across them.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Note (optional)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-10"
          placeholder="e.g. Truck UAP-220"
        />
      </div>

      <Button onClick={submit} disabled={!valid} className="w-full">
        <Plus className="size-4" /> Add expense line
      </Button>
    </div>
  );
}

function BasisButton({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md border p-2.5 text-left text-sm transition-colors",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:bg-accent/60",
      )}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
