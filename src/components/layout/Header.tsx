import { Menu, Plus, Search as SearchIcon, Sparkles, UserPlus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import { emitUIEvent } from "@/lib/ui-events";

export function Header({
  onToggleSidebar,
  onToggleAI,
  aiOpen,
}: {
  onToggleSidebar: () => void;
  onToggleAI: () => void;
  aiOpen: boolean;
}) {
  const navigate = useNavigate();
  const openNewCustomer = async () => {
    await navigate({ to: "/clientes" });
    // dispara após a rota montar o listener
    setTimeout(() => emitUIEvent("customer:new"), 0);
  };
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/60 px-4 backdrop-blur">
      <button
        onClick={onToggleSidebar}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground md:inline-flex"
        aria-label="Alternar menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="hidden max-w-md flex-1 md:block">
        <SearchInput placeholder="Buscar clientes, pedidos, produtos..." />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={openNewCustomer}>
          <UserPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Novo cliente</span>
        </Button>
        <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Novo pedido</span>
        </Button>
        {!aiOpen && (
          <button
            onClick={onToggleAI}
            className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
            aria-label="Abrir Soul AI"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Soul AI
          </button>
        )}
      </div>
    </header>
  );
}

// Re-export icon for callers that want a consistent search glyph
export { SearchIcon };
