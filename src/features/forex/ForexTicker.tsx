import { useState } from "react";
import { useData } from "@/core/store";
import { useSyncUraRateApi } from "./api";
import { fmtRate } from "@/shared/lib/money";
import { Button } from "@/shared/ui/button";
import {
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  WifiOff,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ForexTicker() {
  const data = useData();
  const { liveRate, forex } = data;
  const syncUraRateApi = useSyncUraRateApi();
  const [syncing, setSyncing] = useState(false);
  const [feedDown, setFeedDown] = useState(false);

  const rate = liveRate?.usd_ugx_rate ?? 0;
  const prev = forex
    .filter((f) => f.batch_id === null)
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[1];
  const delta = prev ? rate - prev.usd_ugx_rate : 0;

  // Fetch today's URA Exports rate from the server; degrade gracefully if it's down.
  const refresh = async () => {
    setSyncing(true);
    try {
      const result = await syncUraRateApi();
      if (result.ok) {
        setFeedDown(false);
        await data.refresh();
      } else {
        setFeedDown(true);
      }
    } catch {
      setFeedDown(true);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 sm:gap-3">
      <div className="hidden flex-col leading-none sm:flex">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          USD / UGX
        </span>
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            feedDown ? "text-danger" : "text-muted-foreground",
          )}
        >
          {feedDown && <WifiOff className="size-3" />}
          {feedDown
            ? "feed down"
            : liveRate
              ? `synced ${relativeTime(liveRate.captured_at)}`
              : "no feed"}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="tnum text-lg font-semibold tabular-nums">
          {fmtRate(rate)}
        </span>
        {delta !== 0 && (
          <span
            className={cn(
              "flex items-center text-xs font-medium",
              delta > 0 ? "text-success" : "text-danger",
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {fmtRate(Math.abs(delta))}
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={refresh}
        disabled={syncing}
        aria-label="Sync URA Exports rate"
        title="Sync URA Exports rate"
      >
        <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
      </Button>
    </div>
  );
}
