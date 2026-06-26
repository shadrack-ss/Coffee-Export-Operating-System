import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/core/store";
import { useAuth } from "@/core/auth";
import {
  useSetLiveRateApi,
  useLockRateApi,
  useSyncUraRateApi,
} from "./api";
import { allBatchFinancials } from "@/features/batches";
import { fetchUsdUgx } from "./forexService";
import { PageHeader } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { RiskBadge } from "@/shared/components/badges";
import { fmtRate, fmtUsd } from "@/shared/lib/money";
import {
  RefreshCw,
  Lock,
  WifiOff,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { cn } from "@/shared/lib/utils";

export function Forex() {
  const data = useData();
  const setLiveRateApi = useSetLiveRateApi();
  const lockRateApi = useLockRateApi();
  const syncUraRateApi = useSyncUraRateApi();
  const { can } = useAuth();
  const canManage = can("forex.manage");
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;

  const persistRate = async (rate: number, source: string) => {
    await setLiveRateApi(rate, source);
    await data.refresh();
  };

  const [syncing, setSyncing] = useState(false);
  const [syncingUra, setSyncingUra] = useState(false);
  const [feedDown, setFeedDown] = useState(false);
  const [manual, setManual] = useState("");

  const history = useMemo(
    () =>
      data.forex
        .filter((f) => f.batch_id === null)
        .sort((a, b) => a.captured_at.localeCompare(b.captured_at)),
    [data.forex],
  );

  const prev = history[history.length - 2];
  const delta = prev ? liveRate - prev.usd_ugx_rate : 0;

  const chartData = history.map((f) => ({
    t: new Date(f.captured_at).toLocaleString("en-UG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
    }),
    rate: f.usd_ugx_rate,
  }));

  const fin = useMemo(
    () => allBatchFinancials(data, liveRate),
    [data, liveRate],
  );

  const sync = async () => {
    setSyncing(true);
    const r = await fetchUsdUgx();
    if (r.ok && r.rate) {
      setFeedDown(false);
      await persistRate(r.rate, r.source);
    } else {
      setFeedDown(true);
    }
    setSyncing(false);
  };

  const syncUra = async () => {
    setSyncingUra(true);
    try {
      const r = await syncUraRateApi();
      if (r.ok) {
        setFeedDown(false);
        await data.refresh();
        // Server scrapes in background — poll again to surface any rate change
        setTimeout(() => { data.refresh().catch(() => {}); }, 10_000);
        setTimeout(() => { data.refresh().catch(() => {}); }, 25_000);
      } else {
        setFeedDown(true);
      }
    } catch {
      setFeedDown(true);
    } finally {
      setSyncingUra(false);
    }
  };

  const applyManual = async () => {
    const v = parseFloat(manual);
    if (!Number.isFinite(v) || v <= 0) return;
    await persistRate(v, "URA Exports");
    setManual("");
    setFeedDown(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forex"
        subtitle="USD/UGX rate history and per-batch locking. Use the URA Exports rate for customs-compliant valuations."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* live rate + controls */}
        <Card>
          <CardHeader>
            <CardTitle>Live rate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="tnum text-3xl font-semibold tabular-nums">
                  {fmtRate(liveRate)}
                </span>
                <span className="text-sm text-muted-foreground">UGX</span>
                {delta !== 0 && (
                  <span
                    className={cn(
                      "flex items-center text-sm font-medium",
                      delta > 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {delta > 0 ? (
                      <ArrowUpRight className="size-4" />
                    ) : (
                      <ArrowDownRight className="size-4" />
                    )}
                    {fmtRate(Math.abs(delta))}
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "mt-1 flex items-center gap-1 text-xs",
                  feedDown ? "text-danger" : "text-muted-foreground",
                )}
              >
                {feedDown && <WifiOff className="size-3" />}
                {feedDown
                  ? "Feed unavailable — using last/manual rate."
                  : data.liveRate
                    ? `${data.liveRate.source} · ${new Date(data.liveRate.captured_at).toLocaleString("en-UG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                    : "No rate yet."}
              </p>
            </div>

            {canManage && (
              <>
                <Button onClick={syncUra} disabled={syncingUra} className="w-full">
                  <Download className={cn("size-4", syncingUra && "animate-pulse")} />
                  {syncingUra ? "Fetching from URA…" : "Sync URA Exports rate"}
                </Button>
                <Button onClick={sync} disabled={syncing} variant="outline" className="w-full">
                  <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
                  {syncing ? "Syncing…" : "Sync market rate"}
                </Button>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    URA Exports rate —{" "}
                    <a
                      href="https://www.ura.go.ug/en/exchange-rates/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      ura.go.ug
                    </a>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={manual}
                      onChange={(e) => setManual(e.target.value)}
                      placeholder={fmtRate(liveRate)}
                    />
                    <Button variant="outline" onClick={applyManual}>
                      Set
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter today's URA Exports rate. This is used for customs valuations and locked batch rates.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* history chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rate history</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={["dataMin - 30", "dataMax + 30"]}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                    tickFormatter={(v) => fmtRate(v as number)}
                  />
                  <RTooltip
                    formatter={(v: number) => [fmtRate(v), "USD/UGX"]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#fx)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* per-batch locked vs live */}
      <Card>
        <CardHeader>
          <CardTitle>Per-batch — locked vs live</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Batch</th>
                  <th className="px-3 py-2 text-right font-medium">Locked</th>
                  <th className="px-3 py-2 text-right font-medium">Live</th>
                  <th className="px-3 py-2 text-right font-medium">Move</th>
                  <th className="px-3 py-2 text-right font-medium">Break-even</th>
                  <th className="px-3 py-2 text-right font-medium">Risk</th>
                  {canManage && <th className="px-5 py-2 text-right font-medium">Lock</th>}
                </tr>
              </thead>
              <tbody>
                {fin
                  .filter((f) => f.revenue_ugx > 0)
                  .map((f) => {
                    const move = f.locked_rate ? liveRate - f.locked_rate : 0;
                    return (
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
                        </td>
                        <td className="tnum px-3 py-2.5 text-right tabular-nums">
                          {f.locked_rate ? fmtRate(f.locked_rate) : "—"}
                        </td>
                        <td className="tnum px-3 py-2.5 text-right tabular-nums">
                          {fmtRate(liveRate)}
                        </td>
                        <td
                          className={cn(
                            "tnum px-3 py-2.5 text-right tabular-nums",
                            move > 0 ? "text-success" : move < 0 ? "text-danger" : "text-muted-foreground",
                          )}
                        >
                          {f.locked_rate ? `${move >= 0 ? "+" : ""}${fmtRate(move)}` : "—"}
                        </td>
                        <td className="tnum px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          ${fmtUsd(f.breakeven_usd_per_kg)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <RiskBadge risk={f.risk} />
                        </td>
                        {canManage && (
                          <td className="px-5 py-2.5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await lockRateApi(
                                  f.batch.id,
                                  liveRate,
                                  "locked at costing",
                                );
                                await data.refresh();
                              }}
                            >
                              <Lock className="size-3" /> Lock
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
