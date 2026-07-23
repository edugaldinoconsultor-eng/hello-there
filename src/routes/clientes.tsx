import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · SoulERP" },
      { name: "description", content: "Cadastro e gestão de clientes do distribuidor." },
      { property: "og:title", content: "Clientes · SoulERP" },
      { property: "og:description", content: "Gestão de clientes no SoulERP." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
      <EmptyState
        icon={Users}
        title="Módulo de Clientes em preparação"
        description="A estrutura já está pronta. O cadastro, segmentação e ciclos de recompra serão liberados na próxima etapa."
      />
    </div>
  );
}
