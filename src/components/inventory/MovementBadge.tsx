import { ArrowDownRight, ArrowUpRight, RotateCcw, Scale, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOVEMENT_LABEL, type MovementType } from "@/services/inventory.service";

const STYLES: Record<MovementType, { className: string; Icon: typeof ArrowUpRight }> = {
  IN: { className: "border-success/30 bg-success/10 text-success", Icon: ArrowUpRight },
  RETURN: { className: "border-success/30 bg-success/10 text-success", Icon: RotateCcw },
  OUT: { className: "border-destructive/30 bg-destructive/10 text-destructive", Icon: ArrowDownRight },
  LOSS: { className: "border-destructive/30 bg-destructive/10 text-destructive", Icon: TriangleAlert },
  ADJUSTMENT: { className: "border-primary/30 bg-primary/10 text-primary", Icon: Scale },
};

export function MovementBadge({ type }: { type: MovementType }) {
  const style = STYLES[type] ?? STYLES.IN;
  const { Icon } = style;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        style.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {MOVEMENT_LABEL[type] ?? type}
    </span>
  );
}
