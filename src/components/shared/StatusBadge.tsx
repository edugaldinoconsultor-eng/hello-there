import { cn } from "@/lib/utils";

export type StatusVariant =
  | "pending"
  | "separating"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "paid"
  | "overdue"
  | "neutral";

const styles: Record<StatusVariant, string> = {
  pending: "bg-muted text-muted-foreground",
  separating: "bg-warning/20 text-warning",
  confirmed: "bg-success/20 text-success",
  shipped: "bg-info/20 text-info",
  delivered: "bg-success/20 text-success",
  cancelled: "bg-destructive/20 text-destructive",
  paid: "bg-success/20 text-success",
  overdue: "bg-destructive/20 text-destructive",
  neutral: "bg-secondary text-secondary-foreground",
};

export function StatusBadge({
  variant = "neutral",
  children,
}: {
  variant?: StatusVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[variant],
      )}
    >
      {children}
    </span>
  );
}
