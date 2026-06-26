import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/core/store";
import { useCreateGrnApi, useApiReference } from "./api";
import type { GrnResult } from "@/core/api";
import { computeQuality, recommendGrade } from "@/shared/calc";
import { QualityWorking } from "@/shared/components/QualityWorking";
import { PageHeader } from "@/shared/components/states";
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
import { Combobox } from "@/shared/ui/combobox";
import {
  fmtUgxLabel,
  fmtKgLabel,
  fmtUgx,
  fmtPct,
} from "@/shared/lib/money";
import type { DefectHandlingMode } from "@/shared/types";
import {
  Save,
  AlertTriangle,
  Droplets,
  Bug,
  Wind,
  ChevronDown,
  CheckCircle2,
  Database,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

type Fields = {
  supplier_id: string;
  origin_district: string;
  coffee_grade: string;
  market_price_per_kg: string;
  gross_weight_kg: string;
  tare_weight_kg: string;
  moisture_pct: string;
  fallen_matter_pct: string;
  black_beans_pct: string;
  broken_pct: string;
  husks_pct: string;
  insect_damage_pct: string;
  foreign_matter_pct: string;
};

const EMPTY: Fields = {
  supplier_id: "",
  origin_district: "",
  coffee_grade: "",
  market_price_per_kg: "",
  gross_weight_kg: "",
  tare_weight_kg: "",
  moisture_pct: "",
  fallen_matter_pct: "",
  black_beans_pct: "",
  broken_pct: "",
  husks_pct: "",
  insect_damage_pct: "",
  foreign_matter_pct: "",
};

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

interface Opt {
  value: string;
  label: string;
  districtValue?: string;
}

export function NewGRN() {
  const data = useData();
  const createGrnApi = useCreateGrnApi();
  const navigate = useNavigate();
  const { settings } = data;

  const { data: apiRef, error: refError } = useApiReference();

  // Dropdown options come from the API (value = DB ids).
  const supplierOptions: Opt[] = (apiRef?.suppliers ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} · ${s.type.replace(/_/g, " ")}`,
    districtValue: String(s.district_id),
  }));
  const districtOptions: Opt[] = (apiRef?.districts ?? []).map((d) => ({
    value: String(d.id),
    label: d.name,
  }));
  const gradeOptions: Opt[] = (apiRef?.grades ?? []).map((g) => ({
    value: String(g.id),
    label: g.name,
  }));

  const [f, setF] = useState<Fields>(EMPTY);
  const [mode, setMode] = useState<DefectHandlingMode>(
    settings.default_defect_handling,
  );
  const [showWorking, setShowWorking] = useState(true);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiResult, setApiResult] = useState<GrnResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const set = (key: keyof Fields, value: string) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const onSupplier = (id: string) => {
    const s = supplierOptions.find((x) => x.value === id);
    setF((prev) => ({
      ...prev,
      supplier_id: id,
      origin_district: s?.districtValue ?? prev.origin_district,
    }));
  };

  const defect_pct = useMemo(
    () =>
      Math.round(
        (num(f.black_beans_pct) +
          num(f.broken_pct) +
          num(f.husks_pct) +
          num(f.insect_damage_pct) +
          num(f.foreign_matter_pct)) *
          100,
      ) / 100,
    [f],
  );

  const result = useMemo(
    () =>
      computeQuality(
        {
          gross_weight_kg: num(f.gross_weight_kg),
          tare_weight_kg: num(f.tare_weight_kg),
          moisture_pct: num(f.moisture_pct),
          fallen_matter_pct: num(f.fallen_matter_pct),
          defect_pct,
          defect_handling_mode: mode,
          market_price_per_kg: num(f.market_price_per_kg),
        },
        settings,
      ),
    [f, defect_pct, mode, settings],
  );

  const grade = recommendGrade(num(f.moisture_pct), defect_pct);

  // ---- validation ----
  const errors: Partial<Record<keyof Fields | "defect", string>> = {};
  if (!f.supplier_id) errors.supplier_id = "Select a supplier.";
  if (!f.origin_district) errors.origin_district = "Select a district.";
  if (!f.coffee_grade) errors.coffee_grade = "Select a coffee grade.";
  if (num(f.market_price_per_kg) <= 0)
    errors.market_price_per_kg = "Enter the agreed price.";
  if (num(f.gross_weight_kg) <= 0)
    errors.gross_weight_kg = "Gross weight is required.";
  if (num(f.tare_weight_kg) < 0) errors.tare_weight_kg = "Cannot be negative.";
  if (num(f.tare_weight_kg) >= num(f.gross_weight_kg) && f.gross_weight_kg)
    errors.tare_weight_kg = "Tare must be less than gross.";
  if (defect_pct > 100) errors.defect = "Defect breakdown exceeds 100%.";
  const valid = Object.keys(errors).length === 0;

  const overMoisture = num(f.moisture_pct) > settings.mc_standard_pct;
  const overDefect = defect_pct > settings.defect_standard_pct;

  const defectBreakdown = {
    black_beans_pct: num(f.black_beans_pct),
    broken_pct: num(f.broken_pct),
    husks_pct: num(f.husks_pct),
    insect_damage_pct: num(f.insect_damage_pct),
    foreign_matter_pct: num(f.foreign_matter_pct),
  };

  const save = async () => {
    setTouched(true);
    if (!valid) return;

    // POST to the API → Postgres. Server recomputes authoritatively.
    setSubmitting(true);
    setApiError(null);
    try {
      const res = await createGrnApi({
        supplier_id: f.supplier_id,
        district_id: Number(f.origin_district),
        grade_id: Number(f.coffee_grade),
        buyer_id: null,
        market_price_per_kg: num(f.market_price_per_kg),
        gross_weight_kg: num(f.gross_weight_kg),
        tare_weight_kg: num(f.tare_weight_kg),
        moisture_pct: num(f.moisture_pct),
        fallen_matter_pct: num(f.fallen_matter_pct),
        defect_breakdown: defectBreakdown,
        defect_handling_mode: mode,
      });
      setApiResult(res);
      // pull the new batch into the store so Batches/detail show it live
      void data.refresh();
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setApiResult(null);
    setApiError(null);
    setF(EMPTY);
    setTouched(false);
  };

  const showErr = (key: keyof typeof errors) => touched && errors[key];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New GRN"
        subtitle="Record incoming coffee. Net payable weight and amount payable update live as you grade."
        action={
          <Badge variant="success">
            <Database className="size-3" /> Live · auto-saving
          </Badge>
        }
      />

      {refError && (
        <div className="rounded-md bg-danger-muted px-3 py-2 text-sm text-danger">
          Couldn't load reference data from the API ({refError}). Is it running?
        </div>
      )}

      {apiResult && (
        <Card className="border-success/40 bg-success-muted/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 text-success" />
              <div className="text-sm">
                <div className="font-medium">
                  Saved to PostgreSQL · {apiResult.batch.batch_code}
                </div>
                <div className="text-muted-foreground">
                  Net payable {fmtKgLabel(apiResult.batch.net_payable_weight_kg)} ·
                  recommended {apiResult.recommended_grade} ·{" "}
                  {apiResult.derivation.length} derivation steps (server-computed)
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={reset}>
              Record another
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ---- form ---- */}
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Intake</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Supplier" error={showErr("supplier_id")}>
                <Select value={f.supplier_id} onValueChange={onSupplier}>
                  <SelectTrigger aria-invalid={!!showErr("supplier_id")}>
                    <SelectValue placeholder="Select supplier…" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Origin district" error={showErr("origin_district")}>
                  <Combobox
                    options={districtOptions}
                    value={f.origin_district}
                    onChange={(v) => set("origin_district", v)}
                    placeholder="Select district…"
                    searchPlaceholder="Search districts…"
                  />
                </Field>

                <Field label="Coffee grade" error={showErr("coffee_grade")}>
                  <Select
                    value={f.coffee_grade}
                    onValueChange={(v) => set("coffee_grade", v)}
                  >
                    <SelectTrigger aria-invalid={!!showErr("coffee_grade")}>
                      <SelectValue placeholder="Select grade…" />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeOptions.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <NumberField
                  label="Market price"
                  suffix="UGX/kg"
                  value={f.market_price_per_kg}
                  onChange={(v) => set("market_price_per_kg", v)}
                  error={showErr("market_price_per_kg")}
                />
                <NumberField
                  label="Gross weight"
                  suffix="kg"
                  value={f.gross_weight_kg}
                  onChange={(v) => set("gross_weight_kg", v)}
                  error={showErr("gross_weight_kg")}
                />
                <NumberField
                  label="Tare (bags)"
                  suffix="kg"
                  value={f.tare_weight_kg}
                  onChange={(v) => set("tare_weight_kg", v)}
                  error={showErr("tare_weight_kg")}
                  hint="Weight of bags & packaging."
                />
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberField
                  label="Moisture"
                  suffix="%"
                  icon={Droplets}
                  value={f.moisture_pct}
                  onChange={(v) => set("moisture_pct", v)}
                  hint={`Standard ${settings.mc_standard_pct}%. Each % above is deducted from weight.`}
                  warn={overMoisture}
                />
                <NumberField
                  label="Fallen matter"
                  suffix="%"
                  icon={Wind}
                  value={f.fallen_matter_pct}
                  onChange={(v) => set("fallen_matter_pct", v)}
                  hint={`Deducted off the ${settings.fm_base === "after_mc" ? "moisture-adjusted" : "net physical"} weight.`}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Bug className="size-4 text-muted-foreground" /> Defect
                    breakdown
                  </Label>
                  <Badge variant={overDefect ? "warning" : "outline"}>
                    Total {fmtPct(defect_pct)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <MiniNumber label="Black beans" value={f.black_beans_pct} onChange={(v) => set("black_beans_pct", v)} />
                  <MiniNumber label="Broken" value={f.broken_pct} onChange={(v) => set("broken_pct", v)} />
                  <MiniNumber label="Husks" value={f.husks_pct} onChange={(v) => set("husks_pct", v)} />
                  <MiniNumber label="Insect" value={f.insect_damage_pct} onChange={(v) => set("insect_damage_pct", v)} />
                  <MiniNumber label="Foreign" value={f.foreign_matter_pct} onChange={(v) => set("foreign_matter_pct", v)} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Standard {settings.defect_standard_pct}%. Only the excess above
                  it is penalised.
                </p>
                {showErr("defect") && (
                  <p className="mt-1 text-xs text-danger">{errors.defect}</p>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Excess defect handling</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <ModeButton
                    active={mode === "weight"}
                    onClick={() => setMode("weight")}
                    title="Deduct from weight"
                    desc="Cut the excess % off the payable weight."
                  />
                  <ModeButton
                    active={mode === "discount"}
                    onClick={() => setMode("discount")}
                    title="Price discount"
                    desc="Keep weight; cut price/kg by the excess %."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---- live calculation panel ---- */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-20">
            <Card className="border-primary/30">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Live calculation</CardTitle>
                <Badge variant="primary">{grade}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {(overMoisture || overDefect) && (
                  <div className="flex items-start gap-2 rounded-md bg-warning-muted px-3 py-2 text-xs text-warning-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {overMoisture &&
                        `Moisture ${fmtPct(num(f.moisture_pct))} is above the ${settings.mc_standard_pct}% standard. `}
                      {overDefect &&
                        `Defects ${fmtPct(defect_pct)} exceed the ${settings.defect_standard_pct}% standard.`}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowWorking((s) => !s)}
                  className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Show working
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      showWorking && "rotate-180",
                    )}
                  />
                </button>
                {showWorking && (
                  <QualityWorking
                    steps={result.steps}
                    grossWeight={num(f.gross_weight_kg)}
                  />
                )}

                <div className="space-y-2 border-t border-border pt-3 text-sm">
                  <Row
                    label="Net payable weight"
                    value={fmtKgLabel(result.net_payable_weight_kg)}
                    strong
                  />
                  {mode === "discount" && result.price_discount_pct > 0 && (
                    <Row
                      label={`Price after ${fmtPct(result.price_discount_pct)} discount`}
                      value={`${fmtUgx(result.effective_price_per_kg)} UGX/kg`}
                    />
                  )}
                </div>

                <div className="rounded-md bg-primary/5 p-4 text-center">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Amount payable to farmer
                  </div>
                  <div className="tnum mt-1 text-2xl font-semibold tabular-nums">
                    {fmtUgxLabel(result.amount_paid_to_farmer)}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  <Button
                    className="flex-1"
                    onClick={save}
                    disabled={(touched && !valid) || submitting}
                  >
                    <Save className="size-4" />
                    {submitting ? "Saving…" : "Save GRN"}
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/batches")}>
                    Cancel
                  </Button>
                </div>
                {touched && !valid && (
                  <p className="text-center text-xs text-danger">
                    Fix the highlighted fields to save.
                  </p>
                )}
                {apiError && (
                  <p className="text-center text-xs text-danger">{apiError}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | false;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  error,
  hint,
  warn,
  icon: Icon,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | false;
  hint?: string;
  warn?: boolean;
  icon?: typeof Droplets;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={cn("pr-16", warn && !error && "border-warning")}
          placeholder="0"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function MiniNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 pr-6 text-sm"
          placeholder="0"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          %
        </span>
      </div>
    </div>
  );
}

function ModeButton({
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
        "flex-1 rounded-md border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:bg-accent/60",
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={cn(strong ? "font-medium" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "tnum tabular-nums",
          strong ? "font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}
