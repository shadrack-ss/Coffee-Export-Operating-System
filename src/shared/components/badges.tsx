import { Badge } from "../ui/badge";
import type { BatchStatus } from "../types";
import type { RiskLevel } from "../calc";
import { ShieldCheck, AlertTriangle, TrendingDown } from "lucide-react";

const STATUS_VARIANT: Record<
  BatchStatus,
  "default" | "primary" | "success" | "warning"
> = {
  received: "default",
  graded: "primary",
  costed: "primary",
  processed: "primary",
  approved: "success",
  allocated: "success",
  exported: "success",
};

const STATUS_LABEL: Record<BatchStatus, string> = {
  received: "Received",
  graded: "Graded",
  costed: "Costed",
  processed: "Processed",
  approved: "Approved",
  allocated: "Allocated",
  exported: "Exported",
};

export function StatusBadge({ status }: { status: BatchStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  if (risk === "safe") {
    return (
      <Badge variant="success">
        <ShieldCheck className="size-3" /> Safe
      </Badge>
    );
  }
  if (risk === "watch") {
    return (
      <Badge variant="warning">
        <AlertTriangle className="size-3" /> Watch
      </Badge>
    );
  }
  return (
    <Badge variant="danger">
      <TrendingDown className="size-3" /> Loss risk
    </Badge>
  );
}
