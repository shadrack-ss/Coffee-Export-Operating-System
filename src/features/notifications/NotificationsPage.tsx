import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/core/store";
import { deriveAlerts } from "./alerts";
import { PageHeader, EmptyState } from "@/shared/components/states";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Bell, BellOff, AlertTriangle, Info, TriangleAlert, Radio } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { Severity } from "@/shared/types";

const SEV: Record<Severity, { icon: typeof Info; cls: string; label: string }> = {
  info: { icon: Info, cls: "text-muted-foreground", label: "Info" },
  watch: { icon: AlertTriangle, cls: "text-warning-foreground", label: "Watch" },
  critical: { icon: TriangleAlert, cls: "text-danger", label: "Critical" },
};

export function Notifications() {
  const data = useData();
  const { notifications, update } = data;
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;
  const sorted = [...notifications].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const unread = notifications.filter((n) => !n.read).length;

  const alerts = useMemo(
    () => deriveAlerts(data, liveRate),
    [data, liveRate],
  );
  const sevRank: Record<Severity, number> = { critical: 0, watch: 1, info: 2 };
  const sortedAlerts = [...alerts].sort(
    (a, b) => sevRank[a.severity] - sevRank[b.severity],
  );

  const markAll = () =>
    update({ notifications: notifications.map((n) => ({ ...n, read: true })) });
  const toggle = (id: string) =>
    update({
      notifications: notifications.map((n) =>
        n.id === id ? { ...n, read: !n.read } : n,
      ),
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread · alerts on quality, forex risk, margins and approvals.`}
        action={
          unread > 0 ? (
            <Button variant="outline" size="sm" onClick={markAll}>
              <BellOff className="size-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {/* Live alerts — derived from current state + live rate (§5.7) */}
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Radio className="size-4" /> Live alerts
          <Badge variant="outline">{sortedAlerts.length}</Badge>
        </h2>
        {sortedAlerts.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            All clear — no batches at risk and nothing awaiting approval.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedAlerts.map((a) => {
              const s = SEV[a.severity];
              return (
                <Link key={a.id} to={`/batches/${a.entity_ref}`}>
                  <Card className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/40">
                    <s.icon className={cn("mt-0.5 size-5 shrink-0", s.cls)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            a.severity === "critical"
                              ? "danger"
                              : a.severity === "watch"
                                ? "warning"
                                : "default"
                          }
                        >
                          {s.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {a.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{a.message}</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <h2 className="text-sm font-medium text-muted-foreground">
        Event notifications
      </h2>
      {sorted.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="Alerts will appear here as batches are graded and costed." />
      ) : (
        <div className="space-y-2">
          {sorted.map((n) => {
            const s = SEV[n.severity];
            return (
              <Card
                key={n.id}
                className={cn(
                  "flex items-start gap-3 p-4",
                  !n.read && "border-l-4 border-l-primary",
                )}
              >
                <s.icon className={cn("mt-0.5 size-5 shrink-0", s.cls)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        n.severity === "critical"
                          ? "danger"
                          : n.severity === "watch"
                            ? "warning"
                            : "default"
                      }
                    >
                      {s.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("en-UG", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{n.message}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggle(n.id)}
                  className="shrink-0"
                >
                  {n.read ? "Mark unread" : "Mark read"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
