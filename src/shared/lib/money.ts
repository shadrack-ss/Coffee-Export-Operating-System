/*
 * Money & number handling for CE-OS.
 *
 * RULE: monetary values are stored as INTEGER UGX (the smallest unit — UGX has
 * no minor unit). We never carry fractional UGX in stored figures and never use
 * floats for money. Intermediate arithmetic that must divide (e.g. allocated
 * cost per kg) is rounded explicitly with the helpers below; rounding happens at
 * the moment a per-kg rate is derived or at display — never silently.
 *
 * Weights are kept as numbers in kilograms with controlled precision (3 dp),
 * because partial kilograms are physically real. They are rounded explicitly
 * via `roundKg`.
 */

/** Round to whole UGX (banker-agnostic, half-up). */
export function ugx(value: number): number {
  return Math.round(value);
}

/** Round a weight to 3 decimal places (grams). */
export function roundKg(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Round a per-kg rate to whole UGX. */
export function ratePerKg(total: number, kg: number): number {
  if (kg <= 0) return 0;
  return Math.round(total / kg);
}

/** Round a percentage to 2 dp for display. */
export function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

const ugxFormatter = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 0,
});

const kgFormatter = new Intl.NumberFormat("en-UG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

/** Format whole UGX with thousands separators, e.g. "4,500,000". */
export function fmtUgx(value: number): string {
  return ugxFormatter.format(Math.round(value));
}

/** Format UGX with the "UGX" prefix. */
export function fmtUgxLabel(value: number): string {
  return `UGX ${fmtUgx(value)}`;
}

/** Format a weight in kg, e.g. "940" or "847.5". */
export function fmtKg(value: number): string {
  return kgFormatter.format(value);
}

export function fmtKgLabel(value: number): string {
  return `${fmtKg(value)} kg`;
}

/** Format a percentage value already in percent units, e.g. 14 -> "14%". */
export function fmtPct(value: number, dp = 2): string {
  const rounded = Math.round(value * 10 ** dp) / 10 ** dp;
  return `${rounded}%`;
}

/** Format a USD value (2 dp), used for selling prices and FX. */
export function fmtUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

/** Format a USD/UGX rate, e.g. 3805 -> "3,805". */
export function fmtRate(value: number): string {
  return new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}
