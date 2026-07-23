// MOCK — Today / Home demonstration data. Replace with real queries scoped by companyId.

export const todayMetrics = {
  salesToday: {
    value: "R$ 24.100",
    delta: { value: "+12,4%", direction: "up" as const },
    hint: "vs. ontem R$ 21.440",
  },
  ordersToday: {
    value: "19",
    delta: { value: "+3", direction: "up" as const },
    hint: "em relação a ontem",
  },
  receivables: {
    value: "R$ 14.690",
    hint: "5 títulos em aberto",
  },
  criticalStock: {
    value: "3 produtos",
    hint: "abaixo do mínimo",
  },
};

export type AttentionItem = {
  id: string;
  kind: "recompra" | "pagamento" | "estoque" | "separacao";
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction?: string;
};

export const attentionItems: AttentionItem[] = [
  {
    id: "att_1",
    kind: "recompra",
    title: "Studio Fernanda Costa está próxima da recompra",
    description: "Última compra há 13 dias · Ciclo médio: 28 dias",
    primaryAction: "Criar pedido",
    secondaryAction: "Ver cliente",
  },
  {
    id: "att_2",
    kind: "pagamento",
    title: "3 pagamentos estão vencidos",
    description: "Total R$ 2.130 · Mais antigo: 22 dias",
    primaryAction: "Ver cobranças",
  },
  {
    id: "att_3",
    kind: "estoque",
    title: "Keratina Gold com estoque crítico",
    description: "8 unidades restantes · Mínimo: 15",
    primaryAction: "Ver estoque",
  },
  {
    id: "att_4",
    kind: "separacao",
    title: "8 pedidos aguardam separação",
    description: "Mais antigo criado há 2 dias",
    primaryAction: "Ver pedidos",
  },
];

export const revenue7d = [
  { day: "Seg", value: 18400 },
  { day: "Ter", value: 21200 },
  { day: "Qua", value: 23100 },
  { day: "Qui", value: 27800 },
  { day: "Sex", value: 26400 },
  { day: "Sáb", value: 19500 },
  { day: "Hj", value: 24100 },
];

export type RecentOrder = {
  id: string;
  code: string;
  client: string;
  clientInitial: string;
  date: string;
  amount: string;
  payment: "PIX" | "Boleto" | "Cartão";
  status: "separating" | "confirmed" | "shipped" | "delivered";
};

export const recentOrders: RecentOrder[] = [
  {
    id: "1",
    code: "#PED-2847",
    client: "Hair Design Studio",
    clientInitial: "H",
    date: "23/07/2025",
    amount: "R$ 1.847,50",
    payment: "Boleto",
    status: "separating",
  },
  {
    id: "2",
    code: "#PED-2846",
    client: "Salão Beleza & Arte",
    clientInitial: "S",
    date: "23/07/2025",
    amount: "R$ 643,00",
    payment: "PIX",
    status: "confirmed",
  },
  {
    id: "3",
    code: "#PED-2845",
    client: "Studio Fernanda Costa",
    clientInitial: "F",
    date: "22/07/2025",
    amount: "R$ 2.412,00",
    payment: "Cartão",
    status: "shipped",
  },
  {
    id: "4",
    code: "#PED-2844",
    client: "Espaço Glamour",
    clientInitial: "G",
    date: "22/07/2025",
    amount: "R$ 986,90",
    payment: "PIX",
    status: "delivered",
  },
];
