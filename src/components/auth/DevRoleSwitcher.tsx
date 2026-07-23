import { useState } from "react";
import { Check, FlaskConical, ChevronDown } from "lucide-react";
import { MOCK_USERS, ROLE_LABEL, setCurrentUserId, useSession } from "@/mocks/session";
import { cn } from "@/lib/utils";

/**
 * Seletor de perfil APENAS PARA DESENVOLVIMENTO.
 * Permite testar visualmente as permissões sem alterar código.
 * Deve ser removido/escondido em produção.
 */
export function DevRoleSwitcher({ collapsed }: { collapsed: boolean }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-dashed border-warning/50 bg-warning/5 px-2 py-1.5 text-left text-xs text-warning hover:bg-warning/10",
          collapsed && "justify-center px-0",
        )}
        title="Modo de desenvolvimento — trocar perfil"
      >
        <FlaskConical className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">
              DEV · {ROLE_LABEL[user.role]}
            </span>
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Modo de desenvolvimento
            </div>
            {MOCK_USERS.map((u) => {
              const active = u.id === user.id;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUserId(u.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent",
                    active && "bg-accent",
                  )}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                    {u.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">{u.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {ROLE_LABEL[u.role]}
                    </div>
                  </div>
                  {active && <Check className="h-3 w-3 text-primary" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
