import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  placeholder = "Buscar...",
  value,
  onChange,
  className,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-8 items-center gap-2 rounded-md border border-border bg-secondary/40 px-2.5 text-sm text-foreground focus-within:border-primary/50",
        className,
      )}
    >
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}
