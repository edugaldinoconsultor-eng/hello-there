import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Users,
  ShoppingCart,
  Package,
  Boxes,
  DollarSign,
  Sparkles,
  Settings,
  LogOut,
  ChevronDown,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { currentUser, currentCompany } from "@/mocks/session";

type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

const nav: NavItem[] = [
  { label: "Hoje", to: "/", icon: LayoutGrid },
  { label: "Clientes", to: "/clientes", icon: Users },
  { label: "Pedidos", to: "/pedidos", icon: ShoppingCart, badge: 8 },
  { label: "Produtos", to: "/produtos", icon: Package },
  { label: "Estoque", to: "/estoque", icon: Boxes },
  { label: "Financeiro", to: "/financeiro", icon: DollarSign },
  { label: "Inteligência", to: "/inteligencia", icon: Sparkles },
];

export function Sidebar({ open }: { open: boolean; onToggle: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        open ? "w-60" : "w-16",
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        {open && <span className="text-sm font-semibold tracking-tight">SoulERP</span>}
      </div>

      {/* Company selector */}
      <div className="px-3 pt-3">
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2 py-1.5 text-left text-xs text-sidebar-foreground hover:bg-sidebar-accent",
            !open && "justify-center px-0",
          )}
        >
          <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {open && (
            <>
              <span className="flex-1 truncate">{currentCompany.name}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {nav.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                !open && "justify-center",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {open && <span className="flex-1 truncate">{item.label}</span>}
              {open && item.badge ? (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Settings + user */}
      <div className="border-t border-sidebar-border px-2 py-3">
        <Link
          to="/configuracoes"
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
            !open && "justify-center",
          )}
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          {open && <span>Configurações</span>}
        </Link>

        <div
          className={cn(
            "mt-2 flex items-center gap-2 rounded-md px-2 py-2",
            !open && "justify-center",
          )}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {currentUser.initials}
          </div>
          {open && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-foreground">
                {currentUser.name}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {currentUser.role}
              </div>
            </div>
          )}
        </div>

        <button
          className={cn(
            "mt-1 flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
            !open && "justify-center",
          )}
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
          {open && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
