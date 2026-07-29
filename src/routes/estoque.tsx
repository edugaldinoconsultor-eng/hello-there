import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, Plus, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { MovementBadge } from "@/components/inventory/MovementBadge";
import { MovimentacaoModal } from "@/components/inventory/MovimentacaoModal";
import {
  useInventoryMovements,
  useStockBalances,
  type StockBalance,
} from "@/services/inventory.service";
import { hasPermission } from "@/lib/permissions";
import { useSession } from "@/mocks/session";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque · SoulERP" },
      { name: "description", content: "Saldos, estoque mínimo e histórico de movimentações." },
      { property: "og:title", content: "Estoque · SoulERP" },
      { property: "og:description", content: "Controle de saldos e movimentações no SoulERP." },
    ],
  }),
  component: EstoquePage,
});

function formatDateTime(value: string): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EstoquePage() {
  const { user } = useSession();
  const canAdjust = hasPermission(user, "stock.adjust");

  const balancesState = useStockBalances();
  const movementsState = useInventoryMovements();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  function openMovement(product?: StockBalance) {
    setSelectedProduct(product?.productId ?? null);
    setModalOpen(true);
  }

  function refreshAll() {
    void balancesState.refresh();
    void movementsState.refresh();
  }

  const lowCount = balancesState.balances.filter((b) => b.belowMinimum).length;

  return (
    <RequirePermission permission="stock.view">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Estoque</h1>
            <p className="text-sm text-muted-foreground">
              {balancesState.balances.length} produtos · {lowCount} abaixo do mínimo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            {canAdjust && (
              <Button size="sm" onClick={() => openMovement()}>
                <Plus className="mr-2 h-4 w-4" /> Movimentar
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="saldos">
          <TabsList>
            <TabsTrigger value="saldos">Saldos</TabsTrigger>
            <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          </TabsList>

          <TabsContent value="saldos" className="mt-4 space-y-3">
            {balancesState.error && <ErrorBox message={balancesState.error} />}
            {balancesState.loading && <Loading label="Carregando saldos…" />}
            {!balancesState.loading && !balancesState.error && balancesState.balances.length === 0 && (
              <EmptyState
                icon={Boxes}
                title="Nenhum produto com saldo"
                description="Cadastre produtos ou registre uma entrada para começar."
              />
            )}
            {balancesState.balances.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Produto</th>
                      <th className="px-4 py-2 text-right font-medium">Saldo</th>
                      <th className="px-4 py-2 text-right font-medium">Mínimo</th>
                      <th className="px-4 py-2 text-left font-medium">Situação</th>
                      <th className="px-4 py-2 text-left font-medium">Última mov.</th>
                      {canAdjust && <th className="px-4 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {balancesState.balances.map((b) => (
                      <tr key={b.productId} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2">
                          <div className="font-medium text-foreground">{b.name}</div>
                          <div className="text-[11px] text-muted-foreground">SKU {b.sku || "—"}</div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{b.stock}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {b.minimumStock}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge variant={b.belowMinimum ? "pending" : "confirmed"}>
                            {b.belowMinimum ? "Abaixo do mínimo" : "OK"}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {b.lastMovementAt ? formatDateTime(b.lastMovementAt) : "—"}
                        </td>
                        {canAdjust && (
                          <td className="px-4 py-2 text-right">
                            <Button variant="ghost" size="sm" onClick={() => openMovement(b)}>
                              Movimentar
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="movimentacoes" className="mt-4 space-y-3">
            {movementsState.error && <ErrorBox message={movementsState.error} />}
            {movementsState.loading && <Loading label="Carregando movimentações…" />}
            {!movementsState.loading && !movementsState.error && movementsState.movements.length === 0 && (
              <EmptyState
                icon={Boxes}
                title="Nenhuma movimentação registrada"
                description="Entradas, saídas e ajustes aparecerão aqui com usuário, data e motivo."
              />
            )}
            {movementsState.movements.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Data</th>
                      <th className="px-4 py-2 text-left font-medium">Produto</th>
                      <th className="px-4 py-2 text-left font-medium">Tipo</th>
                      <th className="px-4 py-2 text-right font-medium">Qtd</th>
                      <th className="px-4 py-2 text-right font-medium">Saldo</th>
                      <th className="px-4 py-2 text-left font-medium">Motivo</th>
                      <th className="px-4 py-2 text-left font-medium">Pedido</th>
                      <th className="px-4 py-2 text-left font-medium">Usuário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsState.movements.map((m) => (
                      <tr key={m.id} className="border-b border-border/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-foreground">{m.productName}</div>
                          <div className="text-[11px] text-muted-foreground">{m.productSku}</div>
                        </td>
                        <td className="px-4 py-2">
                          <MovementBadge type={m.type} />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.quantity}</td>
                        <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
                          {m.stockBefore} → <span className="text-foreground">{m.stockAfter}</span>
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-2 text-muted-foreground">
                          {m.reason || "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {m.orderNumber ?? (m.referenceId ? `#${m.referenceId}` : "—")}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{m.userName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {canAdjust && (
          <MovimentacaoModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            balances={balancesState.balances}
            initialProductId={selectedProduct}
            onSaved={refreshAll}
          />
        )}
      </div>
    </RequirePermission>
  );
}
