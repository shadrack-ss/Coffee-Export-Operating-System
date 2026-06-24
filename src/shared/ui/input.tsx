import * as React from "react";
import { cn } from "../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // h-11 base (POS / touch-friendly), tabular for numbers
          "flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition-colors",
          "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/40",
          type === "number" && "tnum tabular-nums",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
