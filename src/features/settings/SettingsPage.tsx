import { useState } from "react";
import { useData } from "@/core/store";
import { useAuth } from "@/core/auth";
import { useUpdateSettingsApi } from "./api";
import { PageHeader } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Save, Check } from "lucide-react";
import type { Settings as SettingsType } from "@/shared/types";

type NumKey = {
  [K in keyof SettingsType]: SettingsType[K] extends number ? K : never;
}[keyof SettingsType];

export function Settings() {
  const { settings, update, refresh } = useData();
  const { can } = useAuth();
  const updateSettingsApi = useUpdateSettingsApi();
  const editable = can("settings.edit");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Edits update local state immediately; in API mode they persist on "Save".
  const setNum = (key: NumKey, value: number) => {
    update({ settings: { ...settings, [key]: value } });
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateSettingsApi({
        mc_standard_pct: settings.mc_standard_pct,
        fm_standard_pct: settings.fm_standard_pct,
        defect_standard_pct: settings.defect_standard_pct,
        default_defect_handling: settings.default_defect_handling,
        fm_base: settings.fm_base,
        ura_tax_pct: settings.ura_tax_pct,
        handling_per_kg: settings.handling_per_kg,
        gunny_bags_per_kg: settings.gunny_bags_per_kg,
        gunny_bags_usd_ref_rate: settings.gunny_bags_usd_ref_rate,
        paperwork_per_kg: settings.paperwork_per_kg,
        target_margin_pct: settings.target_margin_pct,
      });
      await refresh();
      setDirty(false);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Standards and managed lists. Every threshold the calculators use lives here."
        action={
          editable ? (
            <Button onClick={save} disabled={saving || !dirty}>
              {saved && !dirty ? (
                <>
                  <Check className="size-4" /> Saved
                </>
              ) : (
                <>
                  <Save className="size-4" /> {saving ? "Saving…" : "Save to server"}
                </>
              )}
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quality standards</CardTitle>
            <CardDescription>
              Deductions apply only above these thresholds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <NumField label="Moisture standard" suffix="%" value={settings.mc_standard_pct} onChange={(v) => setNum("mc_standard_pct", v)} disabled={!editable} hint="Each % above is deducted from weight." />
            <NumField label="Fallen matter standard" suffix="%" value={settings.fm_standard_pct} onChange={(v) => setNum("fm_standard_pct", v)} disabled={!editable} />
            <NumField label="Defect standard" suffix="%" value={settings.defect_standard_pct} onChange={(v) => setNum("defect_standard_pct", v)} disabled={!editable} hint="Only the excess above this is penalised." />
            <Row label="Defect handling (default)">
              <Badge variant="primary">{settings.default_defect_handling === "weight" ? "Weight deduction" : "Price discount"}</Badge>
            </Row>
            <Row label="Fallen-matter base">
              <Badge variant="outline">{settings.fm_base === "after_mc" ? "Moisture-adjusted weight" : "Net physical weight"}</Badge>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per-kg cost defaults</CardTitle>
            <CardDescription>Build into landed cost on every batch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <NumField label="URA tax" suffix="% of purchase" value={settings.ura_tax_pct} onChange={(v) => setNum("ura_tax_pct", v)} disabled={!editable} />
            <NumField label="Handling" suffix="UGX/kg" value={settings.handling_per_kg} onChange={(v) => setNum("handling_per_kg", v)} disabled={!editable} />
            <NumField label="Gunny bags" suffix="UGX/kg" value={settings.gunny_bags_per_kg} onChange={(v) => setNum("gunny_bags_per_kg", v)} disabled={!editable} hint={`USD-linked · set at rate ${settings.gunny_bags_usd_ref_rate}`} />
            <NumField label="Paperwork" suffix="UGX/kg" value={settings.paperwork_per_kg} onChange={(v) => setNum("paperwork_per_kg", v)} disabled={!editable} />
            <NumField label="Target margin" suffix="%" value={settings.target_margin_pct} onChange={(v) => setNum("target_margin_pct", v)} disabled={!editable} hint="Drives the forex risk flag." />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ListCard title="Coffee grades" items={settings.coffee_grades} />
        <ListCard title="Districts" items={settings.districts} />
        <ListCard title="Expense categories" items={settings.expense_categories} />
      </div>

      {!editable && (
        <p className="text-sm text-muted-foreground">
          You're viewing as a non-admin role — standards are read-only. Switch to
          Admin / Owner in the top bar to edit.
        </p>
      )}
    </div>
  );
}

function NumField({
  label,
  suffix,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="flex items-center gap-2">
          <input
            type="number"
            step="any"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            className="tnum h-8 w-24 rounded-md border border-input bg-card px-2 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          <span className="w-24 text-xs text-muted-foreground">{suffix}</span>
        </span>
      </label>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{items.length} managed values · never free text</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <Badge key={i} variant="outline">
              {i}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
