import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AttentionTone = "info" | "warning" | "danger" | "success";

export function AttentionCard({
  icon: Icon,
  title,
  description,
  tone = "info",
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: AttentionTone;
  actions?: {
    label: string;
    variant?: "primary" | "outline";
    onClick?: () => void;
  }[];
}) {
  const iconTone: Record<AttentionTone, string> = {
    info: "bg-primary/15 text-primary",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
    success: "bg-success/15 text-success",
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          iconTone[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{description}</div>
      </div>
      {actions && actions.length > 0 && (
        <div className="flex shrink-0 items-center gap-1.5">
          {actions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.variant === "primary" ? "default" : "outline"}
              onClick={a.onClick}
              className={
                a.variant === "primary"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : ""
              }
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
