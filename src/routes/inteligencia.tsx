import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/auth/RequirePermission";

export const Route = createFileRoute("/inteligencia")({
  head: () => ({
    meta: [
      { title: "Inteligência · SoulERP" },
      { name: "description", content: "Insights, análises e recomendações da Soul AI." },
      { property: "og:title", content: "Inteligência · SoulERP" },
      { property: "og:description", content: "Central de inteligência do SoulERP." },
    ],
  }),
  component: InteligenciaPage,
});

function InteligenciaPage() {
  return (
    <RequirePermission permission="reports.view.commercial">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inteligência</h1>
        <EmptyState
          icon={Sparkles}
          title="Central de Inteligência em preparação"
          description="Insights de vendas, recompra, ruptura e recomendações da Soul AI serão liberados na próxima etapa."
        />
      </div>
    </RequirePermission>
  );
}

