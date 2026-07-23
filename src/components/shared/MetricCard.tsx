import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricTone = "default" | "danger" | "success" | "warning";

export function MetricCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "neutral" };
  icon: LucideIcon;
  tone?: MetricTone;
}) {
  const toneStyles: Record<MetricTone, string> = {
    default: "border-border bg-card",
    danger: "border-destructive/40 bg-destructive/10",
    success: "border-success/40 bg-success/5",
    warning: "border-warning/40 bg-warning/5",
  };

  const iconTone: Record<MetricTone, string> = {
    default: "bg-secondary text-primary",
    danger: "bg-destructive/20 text-destructive",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
  };

  const deltaColor =
    delta?.direction === "up"
      ? "text-success"
      : delta?.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors hover:border-primary/40",
        toneStyles[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              iconTone[tone],
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        {delta && (
          <span className={cn("text-[11px] font-medium", deltaColor)}>
            {delta.direction === "up" ? "↗" : delta.direction === "down" ? "↘" : "→"}{" "}
            {delta.value}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </div>
        {hint && (
          <div className="pb-1 text-[11px] text-muted-foreground">{hint}</div>
        )}
      </div>
    </div>
  );
}
