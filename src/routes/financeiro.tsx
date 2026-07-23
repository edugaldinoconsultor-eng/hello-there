import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · SoulERP" },
      { name: "description", content: "Contas a receber, pagar e fluxo de caixa." },
      { property: "og:title", content: "Financeiro · SoulERP" },
      { property: "og:description", content: "Financeiro no SoulERP." },
    ],
  }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Financeiro</h1>
      <EmptyState
        icon={DollarSign}
        title="Módulo Financeiro em preparação"
        description="Contas a receber, pagar e conciliação serão implementados na próxima etapa."
      />
    </div>
  );
}
