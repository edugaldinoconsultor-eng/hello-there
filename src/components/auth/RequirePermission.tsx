import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useSession } from "@/mocks/session";
import { hasPermission, type Permission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export function Forbidden({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-foreground">403 · Acesso restrito</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {message ?? "Você não tem permissão para acessar esta área."}
      </p>
      <div className="mt-6">
        <Button asChild size="sm">
          <Link to="/">Voltar para o início</Link>
        </Button>
      </div>
    </div>
  );
}

export function RequirePermission({
  permission,
  children,
  fallback,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useSession();
  if (!hasPermission(user, permission)) return <>{fallback ?? <Forbidden />}</>;
  return <>{children}</>;
}

/**
 * Renderiza `children` só quando o usuário tem a permissão.
 * NÃO é substituto de validação em runtime — use `assertPermission`
 * dentro do handler antes de mutar dados.
 */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useSession();
  return <>{hasPermission(user, permission) ? children : fallback}</>;
}
