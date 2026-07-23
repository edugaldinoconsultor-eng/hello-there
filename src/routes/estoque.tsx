import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/auth/RequirePermission";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque · SoulERP" },
      { name: "description", content: "Controle de estoque e movimentações." },
      { property: "og:title", content: "Estoque · SoulERP" },
      { property: "og:description", content: "Gestão de estoque no SoulERP." },
    ],
  }),
  component: EstoquePage,
});

function EstoquePage() {
  return (
    <RequirePermission permission="stock.view">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Estoque</h1>
        <EmptyState
          icon={Boxes}
          title="Módulo de Estoque em preparação"
          description="Saldo, movimentações e reposição serão implementados na próxima etapa."
        />
      </div>
    </RequirePermission>
  );
}

