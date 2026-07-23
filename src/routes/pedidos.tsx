import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos · SoulERP" },
      { name: "description", content: "Fluxo de pedidos, separação e entrega." },
      { property: "og:title", content: "Pedidos · SoulERP" },
      { property: "og:description", content: "Gestão de pedidos no SoulERP." },
    ],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedidos</h1>
      <EmptyState
        icon={ShoppingCart}
        title="Módulo de Pedidos em preparação"
        description="Criação, separação e acompanhamento serão implementados na próxima etapa."
      />
    </div>
  );
}
