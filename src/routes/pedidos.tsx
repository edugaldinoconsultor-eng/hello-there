import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShoppingCart, Eye, Ban } from "lucide-react";
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
import { useOrders } from "@/mocks/orders";
import { useCustomers } from "@/mocks/customers";
import { MOCK_SALESPEOPLE } from "@/lib/customer-schema";
import { formatBRL, formatDateBR } from "@/lib/order-calc";
import {
  ORDER_STATUS_BADGE, ORDER_STATUS_LABEL, PAYMENT_CONDITION_LABEL,
  type Order, type OrderStatus,
} from "@/lib/order-types";
import { useUIEvent } from "@/lib/ui-events";
import { RequirePermission, Can } from "@/components/auth/RequirePermission";
import { useSession } from "@/mocks/session";
import { assertPermission, canAccessOrder, canCancelOrder, hasPermission } from "@/lib/permissions";


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
  const { orders, updateStatus } = useOrders();
  const { customers } = useCustomers();

  const { user } = useSession();
  const canCreate = hasPermission(user, "orders.create");

  const [novoOpen, setNovoOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<Order | undefined>();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useUIEvent("order:new", () => {
    if (canCreate) setNovoOpen(true);
  });

  // Escopo por perfil: seller só enxerga os próprios pedidos.
  const scoped = useMemo(
    () => orders.filter((o) => canAccessOrder(user, o)),
    [orders, user],
  );

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
    customers.find((c) => c.id === id)?.legalName ?? "—";

  const handleCancel = (o: Order) => {
    // Validação real — não confiar só em esconder o botão.
    assertPermission(user, "orders.cancel");
    if (!canCancelOrder(user, o)) return;
    updateStatus(o.id, "cancelled");
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
          {PAYMENT_CONDITION_LABEL[o.payment.condition]}
          {o.installments.length > 1 && ` · ${o.installments.length}x`}
        </span>
      ),
    },
    {
      key: "status", header: "Status",
      render: (o) => (
        <StatusBadge variant={ORDER_STATUS_BADGE[o.status]}>
          {ORDER_STATUS_LABEL[o.status]}
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
          {canCancelOrder(user, o) && (
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

        {scoped.length === 0 ? (
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

            <section className="rounded-lg border border-border bg-card">
              <DataTable columns={columns} data={filtered} />
            </section>
          </>
        )}

        <NovoPedidoModal open={novoOpen} onOpenChange={setNovoOpen} />
        <PedidoDetalhesModal
          open={detailsOpen} onOpenChange={setDetailsOpen} order={selected}
        />
      </div>
    </RequirePermission>
  );
}

