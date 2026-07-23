import { createFileRoute } from "@tanstack/react-router";
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Package,
  Truck,
  Eye,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MetricCard } from "@/components/shared/MetricCard";
import { AttentionCard } from "@/components/shared/AttentionCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  todayMetrics,
  attentionItems,
  revenue7d,
  recentOrders,
  type RecentOrder,
} from "@/mocks/home";
import { useSession } from "@/mocks/session";
import { RequirePermission } from "@/components/auth/RequirePermission";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoje · SoulERP" },
      {
        name: "description",
        content:
          "Central operacional de hoje: vendas, pedidos, contas a receber, estoque crítico e recomendações da Soul AI.",
      },
      { property: "og:title", content: "Hoje · SoulERP" },
      {
        property: "og:description",
        content: "Central operacional diária para distribuidores de cosméticos.",
      },
    ],
  }),
  component: TodayPage,
});

const statusMap: Record<
  RecentOrder["status"],
  { label: string; variant: React.ComponentProps<typeof StatusBadge>["variant"] }
> = {
  separating: { label: "Separação", variant: "separating" },
  confirmed: { label: "Confirmado", variant: "confirmed" },
  shipped: { label: "Enviado", variant: "shipped" },
  delivered: { label: "Entregue", variant: "delivered" },
};

const attentionMeta: Record<
  string,
  { icon: typeof RefreshCw; tone: "info" | "warning" | "danger" | "success" }
> = {
  recompra: { icon: RefreshCw, tone: "info" },
  pagamento: { icon: Wallet, tone: "danger" },
  estoque: { icon: Package, tone: "warning" },
  separacao: { icon: Truck, tone: "info" },
};

function TodayPage() {
  const { user } = useSession();
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const capToday = today.charAt(0).toUpperCase() + today.slice(1);


  const columns: Column<RecentOrder>[] = [
    {
      key: "code",
      header: "Pedido",
      render: (r) => (
        <span className="font-medium text-primary hover:underline">{r.code}</span>
      ),
    },
    {
      key: "client",
      header: "Cliente",
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-foreground">
            {r.clientInitial}
          </div>
          <span>{r.client}</span>
        </div>
      ),
    },
    { key: "date", header: "Data", render: (r) => <span className="text-muted-foreground">{r.date}</span> },
    { key: "amount", header: "Valor", render: (r) => <span>{r.amount}</span> },
    { key: "payment", header: "Pagamento", render: (r) => <span className="text-muted-foreground">{r.payment}</span> },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusBadge variant={statusMap[r.status].variant}>
          {statusMap[r.status].label}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: () => (
        <button className="text-muted-foreground hover:text-foreground" aria-label="Ver pedido">
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          Bom dia, {user.name.split(" ")[0]} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">{capToday}</p>
      </header>

      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Vendas hoje"
          value={todayMetrics.salesToday.value}
          delta={todayMetrics.salesToday.delta}
          hint={todayMetrics.salesToday.hint}
          icon={TrendingUp}
        />
        <MetricCard
          label="Pedidos hoje"
          value={todayMetrics.ordersToday.value}
          delta={todayMetrics.ordersToday.delta}
          hint={todayMetrics.ordersToday.hint}
          icon={ShoppingCart}
        />
        <MetricCard
          label="Contas a receber"
          value={todayMetrics.receivables.value}
          hint={todayMetrics.receivables.hint}
          icon={DollarSign}
        />
        <MetricCard
          label="Estoque crítico"
          value={todayMetrics.criticalStock.value}
          hint={todayMetrics.criticalStock.hint}
          icon={AlertTriangle}
          tone="danger"
        />
      </section>

      {/* Attention */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Precisa da sua atenção</h2>
          <span className="text-[11px] text-muted-foreground">
            {attentionItems.length} itens
          </span>
        </div>
        <div className="space-y-2">
          {attentionItems.map((item) => {
            const meta = attentionMeta[item.kind];
            const actions = [
              ...(item.secondaryAction
                ? [{ label: item.secondaryAction, variant: "outline" as const }]
                : []),
              { label: item.primaryAction, variant: "primary" as const },
            ];
            return (
              <AttentionCard
                key={item.id}
                icon={meta.icon}
                tone={meta.tone}
                title={item.title}
                description={item.description}
                actions={actions}
              />
            );
          })}
        </div>
      </section>

      {/* Revenue chart */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Faturamento — 7 dias</h2>
            <p className="text-[11px] text-muted-foreground">Total: R$ 160.500</p>
          </div>
          <span className="text-[11px] font-medium text-success">
            ↗ +15,2% vs semana passada
          </span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <AreaChart data={revenue7d} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.62 0.22 295)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.62 0.22 295)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.28 0.02 275)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="oklch(0.68 0.02 275)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="oklch(0.68 0.02 275)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v / 1000}k`}
              />
              <Tooltip
                cursor={{ stroke: "oklch(0.62 0.22 295)", strokeWidth: 1 }}
                contentStyle={{
                  background: "oklch(0.22 0.02 275)",
                  border: "1px solid oklch(0.28 0.02 275)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "oklch(0.68 0.02 275)" }}
                formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "Faturamento"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="oklch(0.62 0.22 295)"
                strokeWidth={2}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent orders */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Pedidos recentes</h2>
          <button className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80">
            Ver todos ›
          </button>
        </div>
        <DataTable columns={columns} data={recentOrders} />
      </section>
    </div>
  );
}
