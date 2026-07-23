// MOCK — Soul AI seed content. Replace with real insight/tool calls when the AI
// backend is wired up. Insights are read-only suggestions in this phase.

export const aiInsights = [
  {
    id: "insight_1",
    headline: "5 clientes",
    body: "estão próximos do período habitual de recompra. Potencial de R$ 24.300 em pedidos esta semana.",
    cta: "Ver oportunidades",
  },
];

export const aiAttention = [
  {
    id: "ai_att_1",
    icon: "alert" as const,
    tone: "danger" as const,
    label: "3 pagamentos atrasados · R$ 2.130",
  },
  {
    id: "ai_att_2",
    icon: "package" as const,
    tone: "warning" as const,
    label: "2 produtos abaixo do estoque mínimo",
  },
  {
    id: "ai_att_3",
    icon: "truck" as const,
    tone: "info" as const,
    label: "8 pedidos aguardam separação",
  },
];

export const aiQuickPrompts = [
  "Quem devo contatar hoje?",
  "Como estão minhas vendas?",
  "O que preciso comprar?",
  "Quem está devendo?",
];
