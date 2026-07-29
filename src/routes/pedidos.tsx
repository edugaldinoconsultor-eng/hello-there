import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShoppingCart, Eye, Ban, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { NovoPedidoModal } from "@/components/orders/NovoPedidoModal";
import { PedidoDetalhesModal } from "@/components/orders/PedidoDetalhesModal";
import { OrcamentoModal } from "@/components/orders/OrcamentoModal";
import { useOrders } from "@/services/orders.service";
import { useCustomers } from "@/services/customers.service";
import { MOCK_SALESPEOPLE } from "@/lib/customer-schema";
import { formatBRL, formatDateBR } from "@/lib/order-calc";
import {
  ORDER_STATUS_BADGE, ORDER_STATUS_LABEL, PAYMENT_CONDITION_LABEL,
  type Order, type OrderStatus,
} from "@/lib/order-types";
import { useUIEvent } from "@/lib/ui-events";
import { RequirePermission, Can } from "@/components/auth/RequirePermission";
import { useSession } from "@/mocks/session";
import { assertPermission, hasPermission } from "@/lib/permissions";


export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos · SoulERP" },
      { name: "description", content: "Criação, acompanhamento e histórico de pedidos." },
      { property: "og:title", content: "Pedidos · SoulERP" },
      { property: "og:description", content: "Fluxo de pedidos rápidos no SoulERP." },
    ],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  const { orders, loading, error, updateStatus, refresh } = useOrders();
  const { customers } = useCustomers();

  const { user } = useSession();
  const canCreate = hasPermission(user, "orders.create");

  const [novoOpen, setNovoOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [orcamentoOpen, setOrcamentoOpen] = useState(false);
  const [selected, setSelected] = useState<Order | undefined>();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useUIEvent("order:new", () => {
    if (canCreate) setNovoOpen(true);
  });

  // O backend (GET /api/v1/orders) JÁ restringe por company_id da sessão e,
  // quando o perfil não tem `orders.view.all`, por seller_id. Reaplicar o
  // filtro em memória aqui escondia todos os pedidos sempre que o formato do
  // ID vindo do MySQL ("1") diferia do ID da sessão. Confiamos no servidor.
  const scoped = orders;


  const filtered = useMemo(() => {
    return scoped.filter((o) => {
      if (from && o.orderDate < from) return false;
      if (to && o.orderDate > to) return false;
      if (customerFilter !== "all" && o.customerId !== customerFilter) return false;
      if (sellerFilter !== "all" && o.sellerId !== sellerFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [scoped, from, to, customerFilter, sellerFilter, statusFilter]);

  const customerName = (id: string) =>
    customers.find((c) => String(c.id) === String(id))?.legalName ?? "—";

  // O backend pode devolver valores fora dos enums do frontend
  // (ex.: payment_condition "30_dias", sale_type ""). Nunca renderizamos
  // célula vazia por causa disso — caímos num rótulo legível.
  const EXTRA_PAYMENT_LABEL: Record<string, string> = {
    "30_dias": "30 dias",
    "30_60": "30/60 dias",
    "30_60_90": "30/60/90 dias",
    balcao: "Balcão",
    faturado: "Faturado",
  };

  const paymentLabel = (o: Order) => {
    const raw = String(o.payment?.condition ?? "");
    if (!raw) return "—";
    return (
      PAYMENT_CONDITION_LABEL[o.payment.condition] ??
      EXTRA_PAYMENT_LABEL[raw] ??
      raw.replace(/_/g, " ")
    );
  };

  const statusLabel = (s: OrderStatus) =>
    ORDER_STATUS_LABEL[s] ?? String(s ?? "—");
  const statusBadge = (s: OrderStatus) => ORDER_STATUS_BADGE[s] ?? "neutral";


  const handleCancel = async (o: Order) => {
    assertPermission(user, "orders.cancel");
    if (o.status === "cancelled") return;
    try {
      await updateStatus(o.id, "cancelled");
    } catch {
      // erro global já exibe toast via api-client / fluxo de sessão
    }
  };



  const columns: Column<Order>[] = [
    {
      key: "orderNumber", header: "Nº",
      render: (o) => <span className="font-medium text-foreground">{o.orderNumber}</span>,
    },
    { key: "customer", header: "Cliente", render: (o) => customerName(o.customerId) },
    { key: "date", header: "Data", render: (o) => formatDateBR(o.orderDate) },
    { key: "seller", header: "Vendedor", render: (o) => o.sellerName ?? "—" },
    {
      key: "total", header: "Valor", align: "right",
      render: (o) => <span className="font-medium">{formatBRL(o.total)}</span>,
    },
    {
      key: "payment", header: "Pagamento",
      render: (o) => (
        <span className="text-muted-foreground">
          {paymentLabel(o)}
          {o.installments.length > 1 && ` · ${o.installments.length}x`}
        </span>
      ),
    },
    {
      key: "status", header: "Status",
      render: (o) => (
        <StatusBadge variant={statusBadge(o.status)}>
          {statusLabel(o.status)}
        </StatusBadge>
      ),
    },
    {
      key: "actions", header: "", align: "right",
      render: (o) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost" size="icon" aria-label="Ver pedido"
            onClick={() => { setSelected(o); setDetailsOpen(true); }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" aria-label="Gerar orçamento"
            onClick={() => { setSelected(o); setOrcamentoOpen(true); }}
          >
            <FileText className="h-4 w-4" />
          </Button>
          {o.status !== "cancelled" && hasPermission(user, "orders.cancel") && (
            <Button
              variant="ghost" size="icon" aria-label="Cancelar pedido"
              onClick={() => handleCancel(o)}
            >
              <Ban className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}

        </div>
      ),
    },
  ];

  return (
    <RequirePermission permission="orders.view">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedidos</h1>
            <p className="text-xs text-muted-foreground">
              {scoped.length} pedido{scoped.length === 1 ? "" : "s"} · {filtered.length} filtrado{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <Can permission="orders.create">
            <Button size="sm" className="gap-1.5" onClick={() => setNovoOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Novo pedido
            </Button>
          </Can>
        </div>

        {loading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Carregando pedidos…
          </div>
        ) : error ? (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="font-medium">Não foi possível carregar os pedidos.</div>
            <div className="text-xs opacity-90">{error}</div>
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              Tentar novamente
            </Button>
          </div>
        ) : scoped.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum pedido encontrado"
            description="Crie o primeiro pedido para começar a acompanhar vendas, pagamentos e entregas."
            action={canCreate ? { label: "Criar primeiro pedido", onClick: () => setNovoOpen(true) } : undefined}
          />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-5">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">De</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Até</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Cliente</label>
                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.legalName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasPermission(user, "orders.view.all") && (
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground">Vendedor</label>
                  <Select value={sellerFilter} onValueChange={setSellerFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {MOCK_SALESPEOPLE.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{ORDER_STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Mobile: cards com ações visíveis */}
            <section className="space-y-2 md:hidden">
              {filtered.map((o) => (
                <div key={o.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">{o.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">{customerName(o.customerId)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateBR(o.orderDate)} · {formatBRL(o.total)}
                      </div>
                    </div>
                    <StatusBadge variant={statusBadge(o.status)}>{statusLabel(o.status)}</StatusBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm" variant="outline" className="gap-1.5"
                      onClick={() => { setSelected(o); setDetailsOpen(true); }}
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Button>
                    <Button
                      size="sm" className="gap-1.5"
                      onClick={() => { setSelected(o); setOrcamentoOpen(true); }}
                    >
                      <FileText className="h-3.5 w-3.5" /> Gerar orçamento
                    </Button>
                    {o.status !== "cancelled" && hasPermission(user, "orders.cancel") && (
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => handleCancel(o)}>
                        <Ban className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </section>

            <section className="hidden rounded-lg border border-border bg-card md:block">
              <DataTable columns={columns} data={filtered} />
            </section>

          </>
        )}

        <NovoPedidoModal open={novoOpen} onOpenChange={setNovoOpen} />
        <PedidoDetalhesModal
          open={detailsOpen} onOpenChange={setDetailsOpen} order={selected}
          onGerarOrcamento={() => { setDetailsOpen(false); setOrcamentoOpen(true); }}
        />
        <OrcamentoModal
          open={orcamentoOpen} onOpenChange={setOrcamentoOpen} order={selected}
        />
      </div>
    </RequirePermission>
  );
}

