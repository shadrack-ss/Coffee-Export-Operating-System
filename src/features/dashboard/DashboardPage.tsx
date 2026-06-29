import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/core/store";
import { allBatchFinancials } from "@/features/batches";
import { KpiCard } from "@/shared/components/KpiCard";
import { Sparkline } from "@/shared/components/Sparkline";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { PageHeader } from "@/shared/components/states";
import { StatusBadge, RiskBadge } from "@/shared/components/badges";
import { fmtUgx, fmtUgxLabel, fmtRate, fmtPct, fmtKg } from "@/shared/lib/money";
import {
  Boxes,
  Coins,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Plus,
  Pencil,
  Package,
  Lock,
  UserPlus,
  UserX,
  Ship,
  Cog,
  KeyRound,
  Trash2,
  Activity,
  type LucideIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { cn } from "@/shared/lib/utils";

export function Dashboard() {
  const data = useData();
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;

  const fin = useMemo(
    () => allBatchFinancials(data, liveRate),
    [data, liveRate],
  );

  const activeBatches = fin.filter(
    (f) => !["exported"].includes(f.batch.status),
  );
  const costed = fin.filter((f) => f.landed_cost_per_kg > 0);
  const avgLanded =
    costed.length > 0
      ? Math.round(
          costed.reduce((s, f) => s + f.landed_cost_per_kg, 0) / costed.length,
        )
      : 0;
  const atRisk = fin.filter((f) => f.risk === "risk");
  const totalPL = fin.reduce((s, f) => s + f.profit_loss_ugx, 0);

  const globalRates = data.forex
    .filter((f) => f.batch_id === null)
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  const prevRate = globalRates[globalRates.length - 2];
  const rateDelta = prevRate ? liveRate - prevRate.usd_ugx_rate : 0;
  const rateHistory = globalRates.slice(-14).map((f) => f.usd_ugx_rate);

  const chartData = fin
    .filter((f) => f.revenue_ugx > 0)
    .map((f) => ({
      name: f.batch.batch_code.replace(/^[A-Z]+-\d+-/, "#"),
      pl: f.profit_loss_ugx,
      risk: f.risk,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Live landed cost, margin and forex risk across all active coffee."
      />

      <div id="tour-kpi-cards" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active batches"
          value={String(activeBatches.length)}
          icon={Boxes}
          tone="primary"
          hint={`${fin.length} total · ${fin.filter((f) => f.batch.status === "received").length} awaiting grading`}
        />
        <KpiCard
          label="Avg landed cost"
          value={fmtUgx(avgLanded)}
          unit="UGX/kg"
          icon={Coins}
          hint={`across ${costed.length} costed batches`}
        />
        <KpiCard
          label="USD / UGX"
          value={fmtRate(liveRate)}
          icon={TrendingUp}
          tone={rateDelta >= 0 ? "success" : "danger"}
          chart={
            <Sparkline
              data={rateHistory}
              stroke={rateDelta >= 0 ? "var(--success)" : "var(--danger)"}
            />
          }
          footer={
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                rateDelta >= 0
                  ? "bg-success-muted text-success"
                  : "bg-danger-muted text-danger",
              )}
            >
              {rateDelta >= 0 ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {fmtRate(Math.abs(rateDelta))} since last sync
            </span>
          }
        />
        <KpiCard
          label="Batches at risk"
          value={String(atRisk.length)}
          icon={AlertTriangle}
          tone={atRisk.length > 0 ? "danger" : "success"}
          hint={
            atRisk.length > 0
              ? "below break-even at the live rate"
              : "all batches above break-even"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Profit / loss by batch</CardTitle>
              <CardDescription>
                Margin per costed batch at the live rate.
              </CardDescription>
            </div>
            <span
              className={cn(
                "tnum rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums",
                totalPL >= 0
                  ? "bg-success-muted text-success"
                  : "bg-danger-muted text-danger",
              )}
            >
              {totalPL >= 0 ? "+" : ""}
              {fmtUgxLabel(totalPL)}
            </span>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                >
                  <defs>
                    {(["safe", "watch", "risk"] as const).map((k) => (
                      <linearGradient
                        key={k}
                        id={`bar-${k}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={RISK_FILL[k]}
                          stopOpacity={0.85}
                        />
                        <stop
                          offset="100%"
                          stopColor={RISK_FILL[k]}
                          stopOpacity={0.35}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeOpacity={0.6}
                    strokeDasharray="2 4"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <RTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    formatter={(v: number) => [fmtUgxLabel(v), "P/L"]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      fontSize: 12,
                      boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
                    }}
                  />
                  <Bar dataKey="pl" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={`url(#bar-${d.risk})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <BreakevenCard fin={fin} liveRate={liveRate} />
      </div>

      <CostBreakdown fin={fin} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>At-risk &amp; watch batches</CardTitle>
            <CardDescription>
              Batches trending toward or below break-even.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <RiskTable fin={fin} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest changes across the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const RISK_FILL = {
  safe: "var(--success)",
  watch: "var(--warning)",
  risk: "var(--danger)",
} as const;

const COST_BUCKETS: Record<string, string> = {
  purchase: "Green coffee",
  ura_tax: "URA tax",
  handling: "Handling",
  gunny_bags: "Gunny bags",
  paperwork: "Paperwork",
  inherited: "Processing input",
};

function CostBreakdown({ fin }: { fin: ReturnType<typeof allBatchFinancials> }) {
  const costed = fin.filter((f) => f.landed_cost_per_kg > 0);
  const totals = new Map<string, number>();
  for (const f of costed) {
    for (const c of f.components) {
      const bucket = COST_BUCKETS[c.key] ?? "Other expenses";
      totals.set(bucket, (totals.get(bucket) ?? 0) + c.per_kg * f.quantity_kg);
    }
  }
  const grand = [...totals.values()].reduce((s, v) => s + v, 0);
  const rows = [...totals.entries()]
    .map(([label, ugx]) => ({
      label,
      ugx,
      pct: grand > 0 ? (ugx / grand) * 100 : 0,
    }))
    .sort((a, b) => b.ugx - a.ugx);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle>Where the cost goes</CardTitle>
          <CardDescription>
            Landed-cost build-up across {costed.length}{" "}
            {costed.length === 1 ? "costed batch" : "costed batches"}.
          </CardDescription>
        </div>
        {grand > 0 && (
          <span className="tnum rounded-full bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums">
            {fmtUgxLabel(Math.round(grand))}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No costed batches yet — cost build-up appears once expenses are added.
          </p>
        ) : (
          <div className="space-y-3.5">
            {rows.map((r) => (
              <div key={r.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{r.label}</span>
                  <span className="tnum tabular-nums text-muted-foreground">
                    {r.pct.toFixed(0)}% · {fmtUgxLabel(Math.round(r.ugx))}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max(2, r.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BreakevenCard({
  fin,
  liveRate,
}: {
  fin: ReturnType<typeof allBatchFinancials>;
  liveRate: number;
}) {
  // Aggregate break-even: weighted average rate needed vs live rate.
  const withRev = fin.filter((f) => f.revenue_ugx > 0);
  const needed =
    withRev.length > 0
      ? Math.round(
          withRev.reduce(
            (s, f) =>
              s +
              (f.breakeven_usd_per_kg /
                Math.max(0.0001, f.selling_price_usd_per_kg)) *
                liveRate,
            0,
          ) / withRev.length,
        )
      : 0;
  const headroom = liveRate - needed;
  const pct = needed > 0 ? Math.min(100, Math.max(0, (liveRate / needed) * 100)) : 0;
  const tone =
    headroom >= 0 ? (headroom > needed * 0.05 ? "success" : "warning") : "danger";
  const stroke = {
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
  }[tone];
  const label = {
    success: "Healthy headroom",
    warning: "Thin margin",
    danger: "Below break-even",
  }[tone];
  const chip = {
    success: "bg-success-muted text-success",
    warning: "bg-warning-muted text-warning-foreground",
    danger: "bg-danger-muted text-danger",
  }[tone];

  const r = 52;
  const circ = Math.PI * r; // half circle
  const offset = circ * (1 - pct / 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Break-even gauge</CardTitle>
        <CardDescription>Live rate vs. the rate needed to clear cost.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <svg viewBox="0 0 140 92" className="w-52">
          <defs>
            <linearGradient id="gauge-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.6} />
              <stop offset="100%" stopColor={stroke} stopOpacity={1} />
            </linearGradient>
          </defs>
          <path
            d="M 18 74 A 52 52 0 0 1 122 74"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M 18 74 A 52 52 0 0 1 122 74"
            fill="none"
            stroke="url(#gauge-fill)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="-mt-8 text-center">
          <div className="tnum text-3xl font-semibold tabular-nums">
            {fmtRate(liveRate)}
          </div>
          <div className="text-xs text-muted-foreground">live USD/UGX</div>
        </div>

        <span
          className={cn(
            "mt-3 rounded-full px-2.5 py-1 text-xs font-medium",
            chip,
          )}
        >
          {label}
        </span>

        <div className="mt-4 w-full space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Break-even rate</span>
            <span className="tnum font-medium tabular-nums">
              {fmtRate(needed)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Headroom</span>
            <span
              className={cn(
                "tnum font-semibold tabular-nums",
                headroom >= 0 ? "text-success" : "text-danger",
              )}
            >
              {headroom >= 0 ? "+" : ""}
              {fmtRate(headroom)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskTable({ fin }: { fin: ReturnType<typeof allBatchFinancials> }) {
  const rows = fin
    .filter((f) => f.risk !== "safe" && f.revenue_ugx > 0)
    .sort((a, b) => a.profit_loss_ugx - b.profit_loss_ugx);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-muted text-success">
          <CheckCircle2 className="size-6" />
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">
          No batches at risk — every costed batch is above break-even at the
          live rate.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-2 font-medium">Batch</th>
            <th className="px-3 py-2 font-medium">Net kg</th>
            <th className="px-3 py-2 text-right font-medium">Landed/kg</th>
            <th className="px-3 py-2 text-right font-medium">P/L</th>
            <th className="px-3 py-2 text-right font-medium">Margin</th>
            <th className="px-5 py-2 text-right font-medium">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr
              key={f.batch.id}
              className="border-b border-border/60 last:border-0 hover:bg-muted/40"
            >
              <td className="px-5 py-2.5">
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
              <td className="tnum px-3 py-2.5 tabular-nums text-muted-foreground">
                {fmtKg(f.net_payable_weight_kg)}
              </td>
              <td className="tnum px-3 py-2.5 text-right tabular-nums">
                {fmtUgx(f.landed_cost_per_kg)}
              </td>
              <td
                className={cn(
                  "tnum px-3 py-2.5 text-right font-medium tabular-nums",
                  f.profit_loss_ugx >= 0 ? "text-success" : "text-danger",
                )}
              >
                {fmtUgx(f.profit_loss_ugx)}
              </td>
              <td className="tnum px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {fmtPct(f.margin_pct)}
              </td>
              <td className="px-5 py-2.5 text-right">
                <RiskBadge risk={f.risk} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ActivityTone = "primary" | "success" | "warning" | "danger" | "default";

const ACTION_META: Record<
  string,
  { icon: LucideIcon; tone: ActivityTone; verb: string }
> = {
  create_grn: { icon: Plus, tone: "success", verb: "recorded GRN" },
  approve_payment: { icon: CheckCircle2, tone: "success", verb: "approved payment" },
  create_user: { icon: UserPlus, tone: "success", verb: "invited" },
  update_user: { icon: Pencil, tone: "primary", verb: "updated" },
  deactivate_user: { icon: UserX, tone: "danger", verb: "deactivated" },
  allocate_batch: { icon: Package, tone: "primary", verb: "allocated to" },
  create_shipment: { icon: Ship, tone: "primary", verb: "created" },
  lock_rate: { icon: Lock, tone: "primary", verb: "locked rate on" },
  record_processing: { icon: Cog, tone: "primary", verb: "processed" },
  add_expense: { icon: Plus, tone: "primary", verb: "added expense to" },
  remove_expense: { icon: Trash2, tone: "danger", verb: "removed expense from" },
  change_password: { icon: KeyRound, tone: "primary", verb: "changed their password" },
  reset_password: { icon: KeyRound, tone: "warning", verb: "reset password for" },
};

const ACTIVITY_ICON: Record<ActivityTone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning-foreground",
  danger: "text-danger",
  default: "text-muted-foreground",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-UG", {
    month: "short",
    day: "numeric",
  });
}

function RecentActivity() {
  const { audit, users, batches, shipments } = useData();

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? null;

  // Turn "batch:<uuid>" / "user:<uuid>" / "shipment:<uuid>" into something human.
  const friendlyEntity = (entity: string): string | null => {
    const [type, id] = entity.split(":");
    if (!id) return entity || null;
    if (type === "user") return userName(id);
    if (type === "batch")
      return batches.find((b) => b.id === id)?.batch_code ?? "a batch";
    if (type === "shipment") {
      const s = shipments.find((x) => x.id === id);
      return s?.container_no ?? "a shipment";
    }
    return type;
  };

  const rows = [...audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Activity className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {rows.map((a) => {
        const meta =
          ACTION_META[a.action] ?? {
            icon: Activity,
            tone: "default" as ActivityTone,
            verb: a.action.replace(/_/g, " "),
          };
        const Icon = meta.icon;
        const actor = userName(a.actor) ?? "Someone";
        const target = friendlyEntity(a.entity);
        const showTarget = target && target !== actor;

        return (
          <li
            key={a.id}
            className="flex items-start gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted/40"
          >
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center",
                ACTIVITY_ICON[meta.tone],
              )}
            >
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">
                <span className="font-medium">{actor}</span>{" "}
                <span className="text-muted-foreground">{meta.verb}</span>
                {showTarget && (
                  <>
                    {" "}
                    <span className="font-medium">{target}</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {relTime(a.at)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
