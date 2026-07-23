import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · SoulERP" },
      { name: "description", content: "Catálogo de produtos do distribuidor." },
      { property: "og:title", content: "Produtos · SoulERP" },
      { property: "og:description", content: "Catálogo de produtos no SoulERP." },
    ],
  }),
  component: ProdutosPage,
});

function ProdutosPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Produtos</h1>
      <EmptyState
        icon={Package}
        title="Módulo de Produtos em preparação"
        description="Catálogo, categorias e preços serão implementados na próxima etapa."
      />
    </div>
  );
}
