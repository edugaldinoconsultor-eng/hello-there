import { createFileRoute } from "@tanstack/react-router";
import { Package, Plus, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useProducts, type Product } from "@/services/products.service";
import { formatBRL } from "@/lib/order-calc";
import { RequirePermission, Can } from "@/components/auth/RequirePermission";
import { NovoProdutoModal } from "@/components/products/NovoProdutoModal";
import { useSession } from "@/mocks/session";
import { hasPermission } from "@/lib/permissions";


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
  const { products, loading, error, refresh } = useProducts();
  const { user } = useSession();
  const canCreate = hasPermission(user, "products.create");
  const [novoOpen, setNovoOpen] = useState(false);

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
    { key: "category", header: "Categoria", render: (p) => <span className="text-muted-foreground">{p.category || "—"}</span> },
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Produtos</h1>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Carregando catálogo…"
                : `${products.length} produto${products.length === 1 ? "" : "s"} disponível${products.length === 1 ? "" : "eis"} para pedidos.`}
            </p>
          </div>
          <Can permission="products.create">
            <Button size="sm" className="gap-1.5" onClick={() => setNovoOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Novo produto
            </Button>
          </Can>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando produtos…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Não foi possível carregar os produtos.</p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => void refresh()}>
                    Tentar novamente
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Cadastre o primeiro produto para começar a montar pedidos."
            action={canCreate ? { label: "Novo produto", onClick: () => setNovoOpen(true) } : undefined}
          />
        ) : (
          <section className="rounded-lg border border-border bg-card">
            <DataTable columns={columns} data={products} />
          </section>
        )}

        <NovoProdutoModal open={novoOpen} onOpenChange={setNovoOpen} />
      </div>
    </RequirePermission>
  );
}
