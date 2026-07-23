import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useProducts, type Product } from "@/mocks/products";
import { formatBRL } from "@/lib/order-calc";
import { RequirePermission } from "@/components/auth/RequirePermission";


export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · SoulERP" },
      { name: "description", content: "Catálogo de produtos disponíveis para pedidos." },
      { property: "og:title", content: "Produtos · SoulERP" },
      { property: "og:description", content: "Catálogo de produtos no SoulERP." },
    ],
  }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const { products } = useProducts();

  const columns: Column<Product>[] = [
    {
      key: "name", header: "Produto",
      render: (p) => (
        <div>
          <div className="font-medium text-foreground">{p.name}</div>
          <div className="text-[11px] text-muted-foreground">SKU {p.sku}</div>
        </div>
      ),
    },
    { key: "category", header: "Categoria", render: (p) => <span className="text-muted-foreground">{p.category}</span> },
    { key: "price", header: "Preço", align: "right", render: (p) => formatBRL(p.price) },
    {
      key: "stock", header: "Estoque", align: "right",
      render: (p) => (
        <span className={p.stock <= p.minimumStock ? "text-warning" : "text-foreground"}>{p.stock}</span>
      ),
    },
    {
      key: "status", header: "Status",
      render: (p) => (
        <StatusBadge variant={p.stock <= p.minimumStock ? "pending" : "confirmed"}>
          {p.stock <= p.minimumStock ? "Estoque baixo" : "OK"}
        </StatusBadge>
      ),
    },
  ];

  return (
    <RequirePermission permission="products.view">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Produtos</h1>
          <p className="text-xs text-muted-foreground">
            {products.length} produto{products.length === 1 ? "" : "s"} disponível{products.length === 1 ? "" : "eis"} para pedidos.
          </p>
        </div>
        {products.length === 0 ? (
          <EmptyState icon={Package} title="Nenhum produto cadastrado" />
        ) : (
          <section className="rounded-lg border border-border bg-card">
            <DataTable columns={columns} data={products} />
          </section>
        )}
      </div>
    </RequirePermission>
  );

}
