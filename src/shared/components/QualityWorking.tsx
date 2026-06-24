import { fmtKg } from "../lib/money";
import { cn } from "../lib/utils";
import type { DerivationStep } from "../calc";

/**
 * Renders the net-payable-weight derivation step by step — the "show working"
 * panel shared by the New GRN calculator and the batch detail. Each step prints
 * the rule it applied and the kg delta, so a grader never has to trust a number
 * blind.
 */
export function QualityWorking({
  steps,
  grossWeight,
  compact = false,
}: {
  steps: DerivationStep[];
  grossWeight: number;
  compact?: boolean;
}) {
  return (
    <ol className={cn("text-sm", compact ? "space-y-1.5" : "space-y-2")}>
      <li className="flex items-baseline justify-between text-muted-foreground">
        <span>Gross weight</span>
        <span className="tnum tabular-nums">{fmtKg(grossWeight)} kg</span>
      </li>
      {steps.map((s) => (
        <li key={s.key} className="border-l-2 border-border pl-3">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">{s.label}</span>
            <span className="tnum font-medium tabular-nums">
              {fmtKg(s.weight_kg)} kg
            </span>
          </div>
          {!compact && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">{s.rule}</span>
              {s.delta_kg !== 0 && (
                <span
                  className={cn(
                    "tnum shrink-0 text-xs tabular-nums",
                    s.delta_kg < 0 ? "text-danger" : "text-success",
                  )}
                >
                  {s.delta_kg > 0 ? "+" : ""}
                  {fmtKg(s.delta_kg)} kg
                </span>
              )}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
