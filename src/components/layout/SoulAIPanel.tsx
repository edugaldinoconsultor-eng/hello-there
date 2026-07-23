import { X } from "lucide-react";
import { SoulAI } from "@/components/soul-ai/SoulAI";
import { cn } from "@/lib/utils";

export function SoulAIPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 border-l border-border bg-sidebar transition-[width] duration-200 lg:flex lg:flex-col",
        open ? "w-[340px]" : "w-0",
      )}
    >
      {open && (
        <>
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-primary">
                <span className="text-[10px] font-bold">AI</span>
              </div>
              <span className="text-sm font-semibold">Soul AI</span>
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                Beta
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Fechar Soul AI"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SoulAI />
          </div>
        </>
      )}
    </aside>
  );
}
