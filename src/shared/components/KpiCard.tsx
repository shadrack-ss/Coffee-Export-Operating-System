import type { ReactNode } from "react";
import { Card } from "../ui/card";
import { cn } from "../lib/utils";
import type { LucideIcon } from "lucide-react";

type Tone = "default" | "success" | "warning" | "danger" | "primary";

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  hint,
  tone = "default",
  footer,
  chart,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  hint?: string;
  tone?: Tone;
  footer?: ReactNode;
  chart?: ReactNode;
}) {
  const iconColor: Record<Tone, string> = {
    default: "text-muted-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning-foreground",
    danger: "text-danger",
  };

  return (
    <Card className="flex min-h-[9.5rem] flex-col p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <Icon className={cn("size-6", iconColor[tone])} />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="tnum text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {chart && <div className="mt-3 -mb-1">{chart}</div>}
      {/* secondary line pinned to the bottom so all cards align */}
      <div className="mt-auto pt-3">
        {footer ?? (hint && <p className="text-xs text-muted-foreground">{hint}</p>)}
      </div>
    </Card>
  );
}
