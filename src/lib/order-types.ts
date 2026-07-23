/**
 * Tipagem forte do domínio de Pedidos.
 *
 * Toda estrutura foi desenhada pensando em:
 *  - Persistência futura (Supabase / Lovable Cloud) — cada campo mapeia
 *    diretamente para uma coluna, sem ambiguidade.
 *  - Escopo multiempresa — `companyId` obrigatório na raiz do pedido.
 *  - Consultas analíticas da Soul AI — snapshots (categoria do produto,
 *    estoque na hora do pedido, valores unitários, etc.) ficam gravados
 *    no próprio pedido para permitir análises históricas consistentes
 *    mesmo que o cadastro do produto mude depois.
 */
import type { PriceTable } from "@/mocks/customers";

export type OrderStatus =
  | "draft"        // rascunho
  | "pending"      // pendente (aguardando algo)
  | "confirmed"    // confirmado pelo vendedor
  | "separating"   // em separação
  | "invoiced"     // faturado
  | "shipped"      // enviado
  | "delivered"    // entregue
  | "cancelled";   // cancelado

export type SaleType = "venda" | "bonificacao" | "amostra" | "troca";

export type PaymentCondition =
  | "a_vista"
  | "pix"
  | "boleto"
  | "cartao"
  | "2x"
  | "3x"
  | "4x"
  | "5x"
  | "6x"
  | "personalizado";

export type DeliveryMethod = "retirada" | "entrega" | "transportadora";

export type OrderItem = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;   // BRL
  discount: number;    // BRL, aplicado no item
  subtotal: number;    // BRL, = qty * unitPrice - discount (>= 0)
  // Snapshots — úteis para Soul AI e para preservar histórico:
  category?: string;
  stockAtOrder?: number;
};

export type OrderInstallment = {
  number: number;
  dueDate: string; // ISO (YYYY-MM-DD)
  amount: number;  // BRL
  paid: boolean;
};

export type OrderPayment = {
  condition: PaymentCondition;
  installmentsCount: number;
};

export type OrderDeliveryAddress = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
};

export type OrderDelivery = {
  method: DeliveryMethod;
  address?: OrderDeliveryAddress;
  carrier?: string;
  freight: number;
  freeShipping: boolean;
  notes?: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  companyId: string;
  customerId: string;

  sellerId?: string;
  sellerName?: string;

  priceTable?: PriceTable;
  saleType: SaleType;
  status: OrderStatus;

  items: OrderItem[];

  subtotal: number;         // soma dos subtotais dos itens (após desconto por item)
  discount: number;         // desconto adicional aplicado no pedido inteiro
  freight: number;          // valor do frete (0 quando frete grátis)
  total: number;            // subtotal - discount + freight

  payment: OrderPayment;
  installments: OrderInstallment[];

  delivery: OrderDelivery;

  notes?: string;
  orderDate: string;           // ISO (YYYY-MM-DD)
  expectedDeliveryDate?: string;

  createdAt: string;
  updatedAt: string;
};

// -------- labels para UI (mantém strings em pt-BR fora dos componentes) --------

export const SALE_TYPE_LABEL: Record<SaleType, string> = {
  venda: "Venda",
  bonificacao: "Bonificação",
  amostra: "Amostra",
  troca: "Troca",
};

export const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  retirada: "Retirada",
  entrega: "Entrega",
  transportadora: "Transportadora",
};

export const PAYMENT_CONDITION_LABEL: Record<PaymentCondition, string> = {
  a_vista: "À vista",
  pix: "Pix",
  boleto: "Boleto",
  cartao: "Cartão",
  "2x": "2x",
  "3x": "3x",
  "4x": "4x",
  "5x": "5x",
  "6x": "6x",
  personalizado: "Personalizado",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  confirmed: "Confirmado",
  separating: "Separação",
  invoiced: "Faturado",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

/** Mapeamento para reuso do <StatusBadge /> existente. */
export const ORDER_STATUS_BADGE: Record<
  OrderStatus,
  "pending" | "separating" | "confirmed" | "shipped" | "delivered" | "cancelled" | "neutral"
> = {
  draft: "neutral",
  pending: "pending",
  confirmed: "confirmed",
  separating: "separating",
  invoiced: "confirmed",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

/** Quantas parcelas cada `PaymentCondition` implica. */
export function installmentsCountFor(condition: PaymentCondition): number {
  switch (condition) {
    case "a_vista":
    case "pix":
    case "boleto":
    case "cartao":
      return 1;
    case "2x": return 2;
    case "3x": return 3;
    case "4x": return 4;
    case "5x": return 5;
    case "6x": return 6;
    case "personalizado": return 1; // ponto de partida — usuário edita
  }
}
