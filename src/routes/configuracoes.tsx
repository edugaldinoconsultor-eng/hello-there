import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/auth/RequirePermission";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · SoulERP" },
      { name: "description", content: "Configurações da empresa, usuários e integrações." },
      { property: "og:title", content: "Configurações · SoulERP" },
      { property: "og:description", content: "Configurações no SoulERP." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  return (
    <RequirePermission permission="settings.access">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configurações</h1>
        <EmptyState
          icon={Settings}
          title="Configurações em preparação"
          description="Empresa, usuários, permissões e integrações serão implementados na próxima etapa."
        />
      </div>
    </RequirePermission>
  );
}

